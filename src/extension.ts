import * as vscode from 'vscode';
import { registerLinkProvider } from './linkProvider';
import { registerCommands } from './commands';
import { registerDiagnostics } from './diagnostics';
import { registerPackageManager } from './packageManager';

import { registerUvEnvTreeView } from './treeView';
import { registerUvStatusAndLogging } from './uvStatusAndLogging';
import { registerUvInterpreterCommand } from './uvInterpreter';
import { registerUvAutoDetect } from './uvAutoDetect';
import { registerUvEnvironmentManager } from './uvEnvManager';

export function activate(context: vscode.ExtensionContext) {
    // Register providers
    registerLinkProvider(context);
    registerCommands(context);
    registerDiagnostics(context);
    registerPackageManager(context);
    registerUvEnvTreeView(context);
    registerUvStatusAndLogging(context);
    registerUvInterpreterCommand(context);
    registerUvAutoDetect(context);
    registerUvEnvironmentManager(context);
    
    // Register language configuration for pyproject.toml
    vscode.languages.setLanguageConfiguration('pyproject-toml', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
    });
}

export function deactivate() {}
