const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

const originalCatch = `        } catch (err: any) {
          console.warn("AI failed to optimize search", err);
          alert("A IA não conseguiu otimizar a busca: " + (err.message || err));
        }`;

const newCatch = `        } catch (err: any) {
          console.warn("AI failed to optimize search", err);
          alert("A IA não conseguiu otimizar a busca: " + (err.message || err));
          // Refund credit
          const refunded = aiCredits; // it was reduced before
          setAiCredits(refunded);
          localStorage.setItem('pref_ai_credits', refunded.toString());
        }`;

content = content.replace(originalCatch, newCatch);
fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
