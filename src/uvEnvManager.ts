import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

interface PythonEnvironment {
    id: string;
    label: string;
    path: string;
    pythonPath: string;
    type: string;
    manager: string;
    isActive: boolean;
    version?: string;
    projectRoot?: string;
}

function getPythonVersion(pythonPath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
        if (!fs.existsSync(pythonPath)) return resolve(undefined);
        child_process.execFile(pythonPath, ['--version'], (err, stdout, stderr) => {
            if (err) return resolve(undefined);
            const version = (stdout || stderr).trim();
            resolve(version.replace(/^Python\s+/, ''));
        });
    });
}

async function findUvEnvsInWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<PythonEnvironment[]> {
    // Scan for all .venv and uv-created envs in workspace and subfolders
    const envs: PythonEnvironment[] = [];
    const searchDirs = [workspaceFolder.uri.fsPath];
    // Optionally, scan subfolders (depth 2)
    for (const dir of searchDirs) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const envPath = path.join(dir, entry.name);
                // Heuristic: look for 'pyproject.toml' and 'uv.lock' to identify UV env roots
                const pyproject = path.join(envPath, 'pyproject.toml');
                const uvlock = path.join(envPath, 'uv.lock');
                const venv = path.join(envPath, '.venv');
                if (fs.existsSync(venv)) {
                    const pythonPath = path.join(venv, 'bin', 'python');
                    const version = await getPythonVersion(pythonPath);
                    envs.push({
                        id: venv,
                        label: `${entry.name} (.venv)` + (version ? ` [${version}]` : ''),
                        path: venv,
                        type: 'venv',
                        manager: UvEnvironmentManager.id,
                        pythonPath,
                        isActive: false,
                        version,
                        projectRoot: envPath
                    } as any);
                } else if (fs.existsSync(pyproject) && fs.existsSync(uvlock)) {
                    // If no .venv, but pyproject.toml and uv.lock exist, treat as UV project
                    const pythonPath = path.join(envPath, 'bin', 'python');
                    const version = await getPythonVersion(pythonPath);
                    envs.push({
                        id: envPath,
                        label: `${entry.name} (UV)` + (version ? ` [${version}]` : ''),
                        path: envPath,
                        type: 'uv',
                        manager: UvEnvironmentManager.id,
                        pythonPath,
                        isActive: false,
                        version,
                        projectRoot: envPath
                    } as any);
                }
            }
        }
    }
    // Also check root .venv
    const rootVenv = path.join(workspaceFolder.uri.fsPath, '.venv');
    if (fs.existsSync(rootVenv)) {
        const pythonPath = path.join(rootVenv, 'bin', 'python');
        const version = await getPythonVersion(pythonPath);
        envs.push({
            id: rootVenv,
            label: `Workspace (.venv)` + (version ? ` [${version}]` : ''),
            path: rootVenv,
            type: 'venv',
            manager: UvEnvironmentManager.id,
            pythonPath,
            isActive: false,
            version,
            projectRoot: workspaceFolder.uri.fsPath
        } as any);
    }
    return envs;
}

export class UvEnvironmentManager {
    static readonly id = 'uv-toolkit:uv';
    static readonly label = 'UV';

    async listEnvironments(workspaceFolder: vscode.WorkspaceFolder): Promise<PythonEnvironment[]> {
        // Scan for all UV envs in workspace and subfolders
        return await findUvEnvsInWorkspace(workspaceFolder);
    }

    async createEnvironment(options: { workspaceFolder?: vscode.WorkspaceFolder, location?: string, pythonVersion?: string }): Promise<PythonEnvironment | undefined> {
        // Prompt for location if not provided
        let location = options.location;
        if (!location) {
            const folder = options.workspaceFolder || vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                vscode.window.showErrorMessage('No workspace folder open.');
                return;
            }
            const defaultPath = path.join(folder.uri.fsPath, '.venv');
            location = await vscode.window.showInputBox({
                prompt: 'Enter the path for the new UV environment',
                value: defaultPath
            });
            if (!location) return;
        }
        // Prompt for Python version if not provided
        let pythonVersion = options.pythonVersion;
        if (!pythonVersion) {
            pythonVersion = await vscode.window.showInputBox({
                prompt: 'Enter Python version (optional, e.g. 3.11)',
                value: ''
            }) || undefined;
        }
        // Create the environment with progress notification
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating UV environment...'
        }, async () => {
            const args = ['venv', '--path', location];
            if (pythonVersion) {
                args.push('--python', pythonVersion);
            }
            return new Promise<PythonEnvironment | undefined>((resolve, reject) => {
                child_process.execFile('uv', args, { cwd: path.dirname(location) }, async (err: any, stdout: string, stderr: string) => {
                    if (err) {
                        vscode.window.showErrorMessage(`Failed to create UV environment: ${stderr || err.message}`);
                        resolve(undefined);
                    } else {
                        const pythonPath = path.join(location, 'bin', 'python');
                        const version = await getPythonVersion(pythonPath);
                        resolve({
                            id: location,
                            label: `UV venv${version ? ` [${version}]` : ''}`,
                            path: location,
                            type: 'venv',
                            manager: UvEnvironmentManager.id,
                            pythonPath,
                            isActive: false,
                            version,
                            projectRoot: path.dirname(location)
                        } as any);
                    }
                });
            });
        });
    }

    async deleteEnvironment(env: PythonEnvironment): Promise<void> {
        if (fs.existsSync(env.path)) {
            fs.rmSync(env.path, { recursive: true, force: true });
            vscode.window.showInformationMessage(`Deleted UV environment at ${env.path}`);
        }
    }

    async activateEnvironment(env: PythonEnvironment): Promise<void> {
        if (fs.existsSync(env.pythonPath)) {
            await vscode.commands.executeCommand('python.setInterpreter', env.pythonPath);
            vscode.window.showInformationMessage(`Activated UV environment: ${env.pythonPath}`);
        }
    }

    async listPackages(env: PythonEnvironment): Promise<any[]> {
        return new Promise((resolve) => {
            const { execFile } = require('child_process');
            execFile('uv', ['pip', 'list', '--format', 'json'], { cwd: env.path }, (err: any, stdout: string) => {
                if (err) return resolve([]);
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    resolve([]);
                }
            });
        });
    }

    async installPackage(env: PythonEnvironment, pkg: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const { execFile } = require('child_process');
            execFile('uv', ['pip', 'install', pkg], { cwd: env.path }, (err: any, stdout: string, stderr: string) => {
                if (err) {
                    vscode.window.showErrorMessage(`Failed to install package: ${stderr || err.message}`);
                    reject(stderr || err.message);
                } else {
                    vscode.window.showInformationMessage(`Installed package: ${pkg}`);
                    resolve();
                }
            });
        });
    }

    async uninstallPackage(env: PythonEnvironment, pkg: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const { execFile } = require('child_process');
            execFile('uv', ['pip', 'uninstall', '-y', pkg], { cwd: env.path }, (err: any, stdout: string, stderr: string) => {
                if (err) {
                    vscode.window.showErrorMessage(`Failed to uninstall package: ${stderr || err.message}`);
                    reject(stderr || err.message);
                } else {
                    vscode.window.showInformationMessage(`Uninstalled package: ${pkg}`);
                    resolve();
                }
            });
        });
    }
}

// Placeholder: Integration with Python Environments API
// When the API is stable, use the following pattern to register UV as an environment manager:
//
// import type { IEnvironmentManagerRegistration, IEnvironmentManager } from 'vscode-python-environments';
//
// export function activate(context: vscode.ExtensionContext) {
//     const pythonEnvsExt = vscode.extensions.getExtension('ms-python.vscode-python-envs');
//     if (pythonEnvsExt && pythonEnvsExt.isActive) {
//         const api = pythonEnvsExt.exports as { registerEnvironmentManager: IEnvironmentManagerRegistration };
//         api.registerEnvironmentManager(new UvEnvironmentManager());
//     } else {
//         // Fallback: register commands for manual use
//         registerUvEnvironmentManager(context);
//     }
// }
//
// Note: The IEnvironmentManager interface should be implemented by UvEnvironmentManager for full API support.
//
// See: https://github.com/microsoft/vscode-python-environments/blob/main/src/api.ts
//
// TODO: When the API is finalized, implement all required methods and events for IEnvironmentManager.

export function registerUvEnvironmentManager(context: vscode.ExtensionContext) {
    const uvManager = new UvEnvironmentManager();
    // Register commands for UI and API compatibility
    context.subscriptions.push(
        vscode.commands.registerCommand('uvToolkit.env.list', async (uri?: vscode.Uri) => {
            const folder = vscode.workspace.getWorkspaceFolder(uri ?? vscode.window.activeTextEditor?.document.uri!);
            if (!folder) return [];
            return uvManager.listEnvironments(folder);
        }),
        vscode.commands.registerCommand('uvToolkit.env.create', async (uri?: vscode.Uri) => {
            const folder = vscode.workspace.getWorkspaceFolder(uri ?? vscode.window.activeTextEditor?.document.uri!);
            if (!folder) return;
            return uvManager.createEnvironment({ workspaceFolder: folder });
        }),
        vscode.commands.registerCommand('uvToolkit.env.delete', async (env: PythonEnvironment) => {
            return uvManager.deleteEnvironment(env);
        }),
        vscode.commands.registerCommand('uvToolkit.env.activate', async (env: PythonEnvironment) => {
            return uvManager.activateEnvironment(env);
        }),
        vscode.commands.registerCommand('uvToolkit.env.listPackages', async (env: PythonEnvironment) => {
            return uvManager.listPackages(env);
        }),
        vscode.commands.registerCommand('uvToolkit.env.installPackage', async (env: PythonEnvironment, pkg: string) => {
            return uvManager.installPackage(env, pkg);
        }),
        vscode.commands.registerCommand('uvToolkit.env.uninstallPackage', async (env: PythonEnvironment, pkg: string) => {
            return uvManager.uninstallPackage(env, pkg);
        }),
        vscode.commands.registerCommand('uvToolkit.env.createAny', async (options?: any) => {
            await vscode.commands.executeCommand('python-envs.createAny', options);
        })
    );
}

