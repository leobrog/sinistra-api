import * as fs from 'fs';

let content = fs.readFileSync('src/database/repositories/EventRepository.ts', 'utf-8');

// Fix limitClause interpolation specifically
content = content.replace(/try: \(\) =>\s*client\(\{\s*sql:\s*`SELECT DISTINCT cmdr FROM event \$\{whereClause\} ORDER BY cmdr ASC \$\{limitClause\}`,\s*args: \[\](?: as any)?,\s*\}\)/s, "try: () => client.unsafe(`SELECT DISTINCT cmdr FROM event ${whereClause} ORDER BY cmdr ASC ${limitClause}`)");
content = content.replace(/try: \(\) =>\s*client\(\{\s*sql:\s*`SELECT \* FROM event \$\{whereClause\} ORDER BY timestamp DESC \$\{limitClause\}`,\s*args: \[\](?: as any)?,\s*\}\)/s, "try: () => client.unsafe(`SELECT * FROM event ${whereClause} ORDER BY timestamp DESC ${limitClause}`)");

// Add correct map return typing
content = content.replace(/return result\.map/g, "return (result as any[]).map");

fs.writeFileSync('src/database/repositories/EventRepository.ts', content, 'utf-8');
