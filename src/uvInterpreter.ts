import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logUvMessage } from './uvStatusAndLogging';

export function registerUvInterpreterCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('uv.setInterpreter', async (venvPath?: string) => {
        try {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                vscode.window.showErrorMessage('No workspace folder open.');
                logUvMessage('No workspace folder open for uv.setInterpreter.', 'error');
                return;
            }
            const pythonPath = path.join(
                venvPath || path.join(folder.uri.fsPath, vscode.workspace.getConfiguration('uvToolkit').get<string>('venvPath', '.venv')),
                'bin',
                'python'
            );
            if (!fs.existsSync(pythonPath)) {
                vscode.window.showErrorMessage('Python executable not found in UV venv.');
                logUvMessage('Python executable not found in UV venv.', 'error');
                return;
            }
            await vscode.commands.executeCommand('python.setInterpreter', pythonPath);
            vscode.window.showInformationMessage(`Python interpreter set to: ${pythonPath}`);
            logUvMessage(`Python interpreter set to: ${pythonPath}`);
        } catch (err: any) {
            vscode.window.showErrorMessage('Failed to set Python interpreter.');
            logUvMessage(`Error setting interpreter: ${err?.message || err}`, 'error');
        }
    }));
}
