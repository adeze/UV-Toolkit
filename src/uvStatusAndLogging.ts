import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

export function registerUvStatusAndLogging(context: vscode.ExtensionContext) {
    // Output channel for logging
    outputChannel = vscode.window.createOutputChannel('UV Toolkit');
    context.subscriptions.push(outputChannel);

    // Enhanced output channel: timestamped log entries
    function logOutput(message: string, type: 'info' | 'error' = 'info') {
        const timestamp = new Date().toISOString();
        if (!outputChannel) return;
        if (type === 'error') {
            outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
        } else {
            outputChannel.appendLine(`[${timestamp}] [INFO] ${message}`);
        }
    }

    // Status bar item for UV environment
    async function updateStatusBar() {
        if (!statusBarItem) {
            statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
            statusBarItem.command = 'uv.openDocs';
            statusBarItem.tooltip = 'UV Python environment status. Click for documentation.';
            context.subscriptions.push(statusBarItem);
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            statusBarItem.hide();
            return;
        }
        const pythonPath = detectUvEnv(workspaceFolders[0].uri.fsPath);
        if (pythonPath) {
            const version = await getPythonVersion(pythonPath);
            statusBarItem.text = `$(beaker) UV Env: ${version}`;
            statusBarItem.tooltip = `UV Python environment detected (${version}). Click for docs.`;
            statusBarItem.show();
        } else {
            statusBarItem.text = '$(beaker) No UV Env';
            statusBarItem.tooltip = 'No UV environment detected. Click for docs.';
            statusBarItem.show();
        }
    }

    // Helper: Detect UV environment
    function detectUvEnv(workspacePath: string): string | undefined {
        const path = require('path');
        const fs = require('fs');
        const venvPath = path.join(workspacePath, '.venv');
        const uvLock = path.join(workspacePath, 'uv.lock');
        const pyproject = path.join(workspacePath, 'pyproject.toml');
        if (fs.existsSync(venvPath) && fs.existsSync(uvLock) && fs.existsSync(pyproject)) {
            const pythonPath = path.join(venvPath, 'bin', 'python');
            if (fs.existsSync(pythonPath)) {
                return pythonPath;
            }
        }
        return undefined;
    }

    // Helper: Get Python version
    function getPythonVersion(pythonPath: string): Promise<string> {
        const { execFile } = require('child_process');
        return new Promise((resolve) => {
            execFile(pythonPath, ['--version'], (err: any, stdout: string, stderr: string) => {
                const versionStr = stdout || stderr;
                resolve(versionStr.trim());
            });
        });
    }

    // Register status bar update on activation
    updateStatusBar();
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(updateStatusBar));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(updateStatusBar));

    // Expose logOutput for use in other modules
    (globalThis as any).uvLogOutput = logOutput;
}

export function logUvMessage(message: string, type: 'info' | 'error' = 'info') {
    if ((globalThis as any).uvLogOutput) {
        (globalThis as any).uvLogOutput(message, type);
    }
}
