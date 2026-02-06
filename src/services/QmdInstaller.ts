import { exec } from 'child_process';
import { promisify } from 'util';
import { Platform } from 'obsidian';

const execAsync = promisify(exec);

export interface InstallProgress {
  stage: 'checking' | 'installing' | 'indexing' | 'embedding' | 'complete' | 'error';
  message: string;
  progress?: number;
}

export type ProgressCallback = (progress: InstallProgress) => void;

const QMD_PATHS = [
  '/usr/local/bin/qmd',
  '/opt/homebrew/bin/qmd',
  `${process.env.HOME}/.bun/bin/qmd`,
  `${process.env.HOME}/.local/bin/qmd`,
  `${process.env.HOME}/.npm-global/bin/qmd`,
];

const BUN_PATHS = [
  '/usr/local/bin/bun',
  '/opt/homebrew/bin/bun',
  `${process.env.HOME}/.bun/bin/bun`,
];

const NPM_PATHS = [
  '/usr/local/bin/npm',
  '/opt/homebrew/bin/npm',
  `${process.env.HOME}/.nvm/versions/node/*/bin/npm`,
];

export class QmdInstaller {
  
  async findQmd(): Promise<string | null> {
    for (const path of QMD_PATHS) {
      try {
        await execAsync(`"${path}" --help`, { timeout: 5000 });
        return path;
      } catch {
        continue;
      }
    }
    
    try {
      const { stdout } = await execAsync('which qmd', { timeout: 5000 });
      const path = stdout.trim();
      if (path) return path;
    } catch {
      // qmd not in PATH
    }
    
    return null;
  }

  async findBun(): Promise<string | null> {
    for (const path of BUN_PATHS) {
      try {
        await execAsync(`"${path}" --version`, { timeout: 5000 });
        return path;
      } catch {
        continue;
      }
    }
    
    try {
      const { stdout } = await execAsync('which bun', { timeout: 5000 });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async findNpm(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('which npm', { timeout: 5000 });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async installQmd(onProgress: ProgressCallback): Promise<string> {
    onProgress({ stage: 'checking', message: 'Checking for package managers...' });

    const existingQmd = await this.findQmd();
    if (existingQmd) {
      onProgress({ stage: 'complete', message: `qmd already installed at ${existingQmd}` });
      return existingQmd;
    }

    const bun = await this.findBun();
    const npm = await this.findNpm();

    if (!bun && !npm) {
      onProgress({ 
        stage: 'error', 
        message: 'Neither bun nor npm found. Please install bun (https://bun.sh) or Node.js first.' 
      });
      throw new Error('No package manager found');
    }

    onProgress({ stage: 'installing', message: 'Installing qmd...', progress: 0 });

    try {
      if (bun) {
        await execAsync(
          `"${bun}" install -g https://github.com/tobi/qmd`,
          { timeout: 300000 }
        );
      } else if (npm) {
        await execAsync(
          `"${npm}" install -g qmd`,
          { timeout: 300000 }
        );
      }

      onProgress({ stage: 'installing', message: 'Verifying installation...', progress: 80 });

      const qmdPath = await this.findQmd();
      if (!qmdPath) {
        throw new Error('qmd installed but not found in PATH');
      }

      onProgress({ stage: 'complete', message: `qmd installed at ${qmdPath}`, progress: 100 });
      return qmdPath;

    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      onProgress({ stage: 'error', message: `Installation failed: ${error}` });
      throw e;
    }
  }

  async indexVault(
    qmdPath: string, 
    vaultPath: string, 
    collectionName: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    onProgress({ stage: 'indexing', message: `Indexing ${collectionName}...`, progress: 0 });

    try {
      const checkResult = await execAsync(
        `"${qmdPath}" collection list --json`,
        { timeout: 30000 }
      ).catch(() => ({ stdout: '[]' }));

      const collections = JSON.parse(checkResult.stdout || '[]');
      const existing = collections.find?.((c: any) => c.name === collectionName);

      if (existing) {
        onProgress({ stage: 'indexing', message: 'Collection exists, updating...', progress: 30 });
        await execAsync(
          `"${qmdPath}" update`,
          { timeout: 300000 }
        );
      } else {
        await execAsync(
          `"${qmdPath}" collection add "${vaultPath}" --name "${collectionName}"`,
          { timeout: 300000 }
        );
      }

      onProgress({ stage: 'indexing', message: 'Indexing complete', progress: 100 });

    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      onProgress({ stage: 'error', message: `Indexing failed: ${error}` });
      throw e;
    }
  }

  async generateEmbeddings(qmdPath: string, onProgress: ProgressCallback): Promise<void> {
    onProgress({ stage: 'embedding', message: 'Generating embeddings (this may take a while)...', progress: 0 });

    try {
      onProgress({ stage: 'embedding', message: 'Downloading models if needed...', progress: 10 });

      await execAsync(
        `"${qmdPath}" embed`,
        { timeout: 1800000 }
      );

      onProgress({ stage: 'embedding', message: 'Embeddings generated', progress: 100 });

    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      onProgress({ stage: 'error', message: `Embedding failed: ${error}` });
      throw e;
    }
  }

  async fullSetup(
    vaultPath: string, 
    collectionName: string,
    onProgress: ProgressCallback
  ): Promise<string> {
    const qmdPath = await this.installQmd(onProgress);
    
    await this.indexVault(qmdPath, vaultPath, collectionName, onProgress);
    
    await this.generateEmbeddings(qmdPath, onProgress);
    
    onProgress({ stage: 'complete', message: 'Setup complete! You can now search your vault.' });
    
    return qmdPath;
  }
}
