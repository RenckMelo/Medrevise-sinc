const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

const original = `                            searchModalResults.map((item) => {
                              const isSelected = item.id === searchModalSelectedId;
                              return (
                                <button
                                  key={item.id}`;

const replacement = `                            searchModalResults.map((item, mapIdx) => {
                              const isSelected = item.id === searchModalSelectedId;
                              return (
                                <button
                                  key={\`search-modal-\${mapIdx}-\${item.id}\`}`;

if (content.includes(original)) {
  content = content.replace(original, replacement);
  fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
  console.log("Successfully patched searchModalResults keys.");
} else {
  console.log("Could not find the target code to patch in TopicDetail.tsx.");
}
