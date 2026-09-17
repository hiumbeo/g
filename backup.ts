import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DATA_FILES = ['antiraid_data.json', 'scan_history.json', 'tiktok_settings.json'];

export function backupData(): string {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubDir = path.join(BACKUP_DIR, `backup-${timestamp}`);
    fs.mkdirSync(backupSubDir);

    let backedUpFiles = [];
    for (const file of DATA_FILES) {
        if (fs.existsSync(path.join(process.cwd(), file))) {
            fs.copyFileSync(path.join(process.cwd(), file), path.join(backupSubDir, file));
            backedUpFiles.push(file);
        }
    }

    return `✅ Đã backup ${backedUpFiles.length} file dữ liệu vào: ${backupSubDir}`;
}
