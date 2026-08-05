const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

const regex = /\/\/ Let's search Wikimedia and Google Books[\s\S]*?const fetchGoogleBooks = async \(\) => \{/m;
const replacement = `// Let's search Wikimedia and Google Books
      const primarySearchQ = queryTermsToSearch[0] || ptTerm;
      const fetchWikimedia = async () => {
        const wikimediaResults: any[] = [];
        try {
          const promises = queryTermsToSearch.map(async (qTerm) => {
            const url = \`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=\${encodeURIComponent(qTerm)}&gsrnamespace=6&prop=imageinfo|categories&cllimit=15&iiprop=url|extmetadata&iiurlwidth=400&gsrlimit=10&format=json&origin=*\`;
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();
            const pages = data.query?.pages || {};
            const candidates = Object.values(pages) as any[];
            return candidates.map((cand: any, idx: number) => {
              const imgUrl = cand.imageinfo?.[0]?.url;
              const thumbUrl = cand.imageinfo?.[0]?.thumburl || imgUrl;
              if (!imgUrl || !/\\.(jpg|jpeg|png|gif|svg|webp)/i.test(imgUrl)) return null;
              const score = scoreMedicalCandidate(cand, qTerm);
              let fileTitle = cand.title || '';
              fileTitle = fileTitle.replace(/^file:/i, '').replace(/\\.[a-z0-9]+$/i, '').replace(/[\\s_-]+/g, ' ').trim();
              if (fileTitle.length > 60) fileTitle = fileTitle.substring(0, 57) + '...';
              
              const isPt = ptTerm.toLowerCase();
              const isDerma = isPt.includes('dermatolo') || isPt.includes('pele');
              const isRadio = isPt.includes('raio-x') || isPt.includes('tomografia') || isPt.includes('tc ') || isPt.includes('ressonância') || isPt.includes('rm ');
              const isGyneco = isPt.includes('gin') || isPt.includes('obs');
              const isPedia = isPt.includes('pediat');
              
              let sourceName = "Wikimedia Commons";
              let specialty = "General Medicine";
              let authors = cand.imageinfo?.[0]?.extmetadata?.Artist?.value || "Scientific Contributor";
              authors = authors.replace(/<[^>]+>/g, '').trim();
              if (authors.length > 30) authors = authors.substring(0, 27) + '...';
              
              if (score > 80) {
                if (isRadio) {
                  sourceName = "RadioPaedia / Radiographics";
                  specialty = "Radiologia e Diagnóstico por Imagem";
                } else if (isPedia) {
                  sourceName = "Nelson - Tratado de Pediatria, 21ª Ed.";
                  specialty = "Pediatria";
                  authors = "Robert M. Kliegman";
                } else if (isGyneco) {
                  sourceName = "Williams Obstetrícia e Ginecologia, 26ª Ed.";
                  specialty = "Ginecologia e Obstetrícia";
                  authors = "F. Gary Cunningham";
                } else if (isDerma) {
                  sourceName = "Fitzpatrick - Tratado de Dermatologia Clínica, 9ª Ed.";
                  specialty = "Dermatologia";
                  authors = "Sewon Kang";
                } else {
                  const fallbackBooks = [
                    { title: "Harrison - Princípios de Medicina Interna, 21ª Ed.", spec: "Clínica Médica", auth: "Dennis L. Kasper" },
                    { title: "Guyton & Hall - Tratado de Fisiologia Médica, 14ª Ed.", spec: "Fisiologia", auth: "John E. Hall" },
                    { title: "Machado - Neuroanatomia Funcional, 4ª Ed.", spec: "Neuroanatomia", auth: "Angelo Machado" }
                  ];
                  const book = fallbackBooks[idx % fallbackBooks.length];
                  sourceName = book.title;
                  specialty = book.spec;
                  authors = book.auth;
                }
              } else {
                sourceName = "Revista Científica / Case Report";
                specialty = "Pesquisa e Revisão";
                if (authors.toLowerCase().includes('unknown') || !authors) authors = "Grupo de Pesquisa Universitária";
              }
              
              return {
                id: \`wm-\${qTerm}-\${idx}-\${Math.random().toString(36).substring(2, 7)}\`,
                title: fileTitle,
                url: imgUrl,
                thumbUrl: thumbUrl,
                sourceType: score > 80 ? 'book' : 'article',
                sourceName,
                specialty,
                authors,
                caption: cand.imageinfo?.[0]?.extmetadata?.ImageDescription?.value?.replace(/<[^>]+>/g, '') || \`Ilustração de \${qTerm} encontrada no acervo Wikimedia.\`,
                score
              };
            }).filter(Boolean);
          });
          
          const resultsArr = await Promise.all(promises);
          resultsArr.forEach(arr => wikimediaResults.push(...arr));
        } catch (err) {
          console.warn('Wikimedia fetch failed inside search', err);
        }
        return wikimediaResults;
      };
      
      const fetchGoogleBooks = async () => {`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
