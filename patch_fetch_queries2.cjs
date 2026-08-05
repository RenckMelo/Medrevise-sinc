const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

const regex = /const fetchGoogleBooks = async \(\) => \{[\s\S]*?return bookResults;\n      \};/m;
const replacement = `const fetchGoogleBooks = async () => {
        const bookResults: any[] = [];
        if (!searchModalSourceBooks) return bookResults;
        try {
          const promises = queryTermsToSearch.map(async (qTerm) => {
            const res = await fetch(\`https://www.googleapis.com/books/v1/volumes?q=\${encodeURIComponent(qTerm + ' medicina')}&maxResults=4\`);
            if (!res.ok) return [];
            const data = await res.json();
            const items = data.items || [];
            return items.map((item: any, idx: number) => {
              const info = item.volumeInfo || {};
              const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
              if (thumb) {
                let imgUrl = thumb;
                if (imgUrl.startsWith('http://')) {
                  imgUrl = imgUrl.replace('http://', 'https://').replace('&edge=curl', '');
                }
                
                return {
                  id: \`gb-\${item.id || idx}-\${Math.random().toString(36).substr(2, 5)}\`,
                  title: info.title || cleanQuery,
                  url: imgUrl,
                  caption: \`Capa e ilustrações de referência para o tema: \${info.title}.\`,
                  sourceType: 'book',
                  sourceName: \`\${info.title} (\${info.publishedDate?.substring(0, 4) || 'Edição Recente'})\`,
                  specialty: "Livro de Referência",
                  authors: info.authors?.join(', ') || 'Autores Acadêmicos',
                  score: 50
                };
              }
              return null;
            }).filter(Boolean);
          });
          const resultsArr = await Promise.all(promises);
          resultsArr.forEach(arr => bookResults.push(...arr));
        } catch (err) {
          console.warn('Google books fetch failed inside search', err);
        }
        return bookResults;
      };`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
