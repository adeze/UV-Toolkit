import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

class UvEnvTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    if (command) this.command = command;
  }
}

class UvEnvTreeProvider implements vscode.TreeDataProvider<UvEnvTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<UvEnvTreeItem | null | undefined> = new vscode.EventEmitter<UvEnvTreeItem | null | undefined>();
  readonly onDidChangeTreeData: vscode.Event<UvEnvTreeItem | null | undefined> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: UvEnvTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: UvEnvTreeItem): Thenable<UvEnvTreeItem[]> {
    if (!vscode.workspace.workspaceFolders) {
      return Promise.resolve([]);
    }
    const groupBy = vscode.workspace.getConfiguration('uvToolkit').get<string>('treeViewGroupBy', 'folder');
    const showScripts = vscode.workspace.getConfiguration('uvToolkit').get<boolean>('treeViewShowScripts', true);
    const items: UvEnvTreeItem[] = [];
    if (groupBy === 'venv') {
      for (const folder of vscode.workspace.workspaceFolders) {
        const venvPath = vscode.workspace.getConfiguration('uvToolkit').get<string>('venvPath', '.venv');
        const envRoot = path.join(folder.uri.fsPath, venvPath);
        if (fs.existsSync(envRoot)) {
          items.push(new UvEnvTreeItem(
            `${folder.name}: UV venv (${venvPath})`,
            showScripts ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            'uvVenvRoot',
          ));
        }
      }
      if (element && element.contextValue === 'uvVenvRoot' && showScripts) {
        const folder = vscode.workspace.workspaceFolders?.find(f => element.label.startsWith(f.name + ':'));
        if (folder) {
          const pyprojectPath = path.join(folder.uri.fsPath, 'pyproject.toml');
          if (fs.existsSync(pyprojectPath)) {
            try {
              const content = fs.readFileSync(pyprojectPath, 'utf8');
              const scripts = parseScriptsFromPyproject(content);
              return Promise.resolve(scripts.map(script =>
                new UvEnvTreeItem(
                  script,
                  vscode.TreeItemCollapsibleState.None,
                  'uvScript',
                  { command: 'uv.runScript', title: 'Run Script', arguments: [folder.uri.fsPath, script] }
                )
              ));
            } catch { }
          }
        }
      }
      return Promise.resolve(items);
    } else {
      for (const folder of vscode.workspace.workspaceFolders) {
        const venvPath = vscode.workspace.getConfiguration('uvToolkit').get<string>('venvPath', '.venv');
        const envRoot = path.join(folder.uri.fsPath, venvPath);
        if (fs.existsSync(envRoot)) {
          items.push(new UvEnvTreeItem(
            `${folder.name}: UV venv (${venvPath})`,
            showScripts ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            'uvVenvRoot',
          ));
        }
      }
      if (element && element.contextValue === 'uvVenvRoot' && showScripts) {
        const folder = vscode.workspace.workspaceFolders?.find(f => element.label.startsWith(f.name + ':'));
        if (folder) {
          const pyprojectPath = path.join(folder.uri.fsPath, 'pyproject.toml');
          if (fs.existsSync(pyprojectPath)) {
            try {
              const content = fs.readFileSync(pyprojectPath, 'utf8');
              const scripts = parseScriptsFromPyproject(content);
              return Promise.resolve(scripts.map(script =>
                new UvEnvTreeItem(
                  script,
                  vscode.TreeItemCollapsibleState.None,
                  'uvScript',
                  { command: 'uv.runScript', title: 'Run Script', arguments: [folder.uri.fsPath, script] }
                )
              ));
            } catch { }
          }
        }
      }
      return Promise.resolve(items);
    }
  }
}

function parseScriptsFromPyproject(content: string): string[] {
  const scripts: string[] = [];
  const scriptSection = content.match(/\[tool\.uv\.scripts\]([\s\S]*?)(\n\[|$)/) || content.match(/\[project\.scripts\]([\s\S]*?)(\n\[|$)/);
  if (scriptSection) {
    const lines = scriptSection[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^(\w+)\s*=.*/);
      if (m) scripts.push(m[1]);
    }
  }
  return scripts;
}

export function registerUvEnvTreeView(context: vscode.ExtensionContext) {
  const uvEnvTreeProvider = new UvEnvTreeProvider();
  vscode.window.registerTreeDataProvider('uvEnvsView', uvEnvTreeProvider);
  context.subscriptions.push(vscode.commands.registerCommand('uv.refreshEnvs', () => uvEnvTreeProvider.refresh()));
}
