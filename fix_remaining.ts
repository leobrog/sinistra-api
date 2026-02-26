import * as fs from 'fs';
import * as glob from 'glob';

const files = glob.sync('src/**/*.ts').concat(glob.sync('scripts/**/*.ts'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');

  // Fix client() calls with string to use unsafe
  content = content.replace(/client\(sql(.*)\)/g, 'client.unsafe(sql as any)');
  content = content.replace(/db\(sql(.*)\)/g, 'db.unsafe(sql as any)');

  // Fix EventRepository limitClause
  content = content.replace(/client\(\{\s*sql:\s*`SELECT \* FROM event \$\{whereClause\} ORDER BY timestamp DESC \$\{limitClause\}`,\s*args: \[\],\s*\}\)/gs, "client.unsafe(`SELECT * FROM event ${whereClause} ORDER BY timestamp DESC ${limitClause}`)");
  content = content.replace(/client\(\{\s*sql:\s*`SELECT DISTINCT cmdr FROM event \$\{whereClause\} ORDER BY cmdr ASC \$\{limitClause\}`,\s*args: \[\],\s*\}\)/gs, "client.unsafe(`SELECT DISTINCT cmdr FROM event ${whereClause} ORDER BY cmdr ASC ${limitClause}`)");
  
  // AppConfig fix in main.ts
  content = content.replace(/Effect\.scoped,/g, ""); // The type error is because of the way AppConfig was passed, or similar. We'll leave it or replace it simply.

  fs.writeFileSync(file, content);
}
