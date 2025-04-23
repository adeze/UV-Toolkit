import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logUvMessage } from './uvStatusAndLogging';

export function registerUvAutoDetect(context: vscode.ExtensionContext) {
    // Automatically update the tree view and status bar when UV env changes
    function refreshAll() {
        vscode.commands.executeCommand('uv.refreshEnvs');
        // Status bar auto-updates via uvStatusAndLogging
    }

    // Watch for changes to pyproject.toml, uv.lock, or .venv
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(folder, '{pyproject.toml,uv.lock,.venv/**}')
            );
            watcher.onDidChange(refreshAll);
            watcher.onDidCreate(refreshAll);
            watcher.onDidDelete(refreshAll);
            context.subscriptions.push(watcher);
        }
    }
}
