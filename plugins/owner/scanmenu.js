// plugins/owner/auto-register-menu.js
const fs = require('fs');
const path = require('path');
const { card } = require('../../lib/theme');

const handler = async (m, { command, prefix }) => {
  
  if (command === 'scanmenu') {
    // Scan semua plugin di folder
    const pluginsDir = path.join(process.cwd(), 'plugins');
    let found = 0;
    let registered = 0;
    
    function scanDir(dir) {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDir(filePath);
        } else if (file.endsWith('.js')) {
          found++;
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Cek apakah plugin sudah memiliki tags
            if (!content.includes('handler.tags')) {
              // Tambahkan tags default
              const folderName = path.basename(path.dirname(filePath));
              const defaultTag = folderName || 'tools';
              
              // Tambahkan tags ke file
              const updated = content.replace(
                /handler\.command\s*=\s*\[([^\]]+)\]/,
                (match, cmds) => {
                  const tags = `handler.tags = ["${defaultTag}"];`;
                  const help = `handler.help = ${cmds.trim()};`;
                  return `${match}\n${tags}\n${help}`;
                }
              );
              
              if (updated !== content) {
                fs.writeFileSync(filePath, updated);
                registered++;
              }
            }
          } catch (e) {
            console.log(`Error register ${file}:`, e.message);
          }
        }
      }
    }
    
    scanDir(pluginsDir);
    
    return m.reply(card("SCAN COMPLETE", [
      `📁 Total Plugin: ${found}`,
      `📝 Registered: ${registered}`,
      `🔄 Restart bot untuk melihat perubahan!`,
    ], "✅"));
  }
};

// FIX BUG: sebelumnya "regall" terdaftar sebagai alias di sini tapi gak
// pernah ditangani sama sekali (cuma `if (command === 'scanmenu')`, gak ada
// cabang buat 'regall') — jadi kalau dipanggil, function selesai TANPA EFEK
// APA PUN, bot diem total kayak command itu gak ada, padahal listmenu/menu
// nunjukkin dia valid. Gak ada bukti 'regall' dimaksudkan beda dari
// 'scanmenu' (nama = "register all", fungsinya emang persis "register semua
// plugin" yang sama), jadi dihapus aja daripada jadi command hantu yang
// nge-bug diam-diam.
handler.command = ['scanmenu'];
handler.tags = ["admin"];
handler.admin = true;

module.exports = handler;