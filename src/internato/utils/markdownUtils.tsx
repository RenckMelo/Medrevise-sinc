import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { 
  Image as ImageIcon, ExternalLink, AlertCircle, Search, ImageOff, Heart, RotateCw, RotateCcw,
  Upload, Trash2, Link, Activity, Stethoscope, CheckCircle2, ShieldAlert, Sparkles, 
  Brain, Zap, FileText, Lightbulb, Pill, UserCheck, GitBranch, ChevronDown, ArrowDown, Award,
  ChevronRight, Home, ArrowRight, Play, HelpCircle, ZoomIn, ZoomOut, Maximize2, Minimize2, Bookmark,
  Sun, Moon, Terminal, X, LayoutGrid, RefreshCw
} from 'lucide-react';
import { StaticMedicalFigure } from '../components/StaticMedicalFigure';

export const getEnglishMedicalTerm = (ptText: string): string => {
  if (!ptText) return '';
  let text = ptText.toLowerCase().trim();
  
  // Custom static dictionary for extremely common medical terms in Portuguese
  const directMaps: Record<string, string> = {
    'corrimento': 'vaginal discharge',
    'corrimento vaginal': 'vaginal discharge',
    'corrimento amarelado': 'yellowish vaginal discharge',
    'corrimento vaginal amarelado': 'yellowish purulent vaginal discharge',
    'corrimento purulento': 'purulent discharge',
    'corrimento esverdeado': 'greenish vaginal discharge',
    'corrimento esbranquiçado': 'white curd-like discharge',
    'leucorreia': 'leukorrhea',
    'vulvovaginite': 'vulvovaginitis',
    'candidíase vulvovaginal': 'vulvovaginal candidiasis',
    'candidiase vulvovaginal': 'vulvovaginal candidiasis',
    'cervicite': 'cervicitis',
    'cervicite (endocérvix)': 'cervicitis endocervix',
    'cervicite (endocervix)': 'cervicitis endocervix',
    'cervicite endocérvix': 'cervicitis endocervix',
    'cervicite endocervix': 'cervicitis endocervix',
    'cervicite aguda': 'acute cervicitis',
    'cervicite crônica': 'chronic cervicitis',
    'cervicite cronica': 'chronic cervicitis',
    'endocérvix': 'endocervix',
    'endocervix': 'endocervix',
    'exocérvix': 'exocervix',
    'exocervix': 'exocervix',
    'cervicite vs. vaginite': 'cervicitis vs vaginitis',
    'cervicite vs vaginite': 'cervicitis vs vaginitis',
    'vaginite': 'vaginitis',
    'vaginose': 'vaginosis',
    'vaginose bacteriana': 'bacterial vaginosis',
    'colpite': 'colpitis',
    'colo uterino': 'cervix',
    'colo do útero': 'cervix',
    'colo do utero': 'cervix',
    'apendicite': 'appendicitis',
    'apendicite aguda': 'acute appendicitis',
    'toque binomial': 'bimanual pelvic examination',
    'toque binomial ginecologico': 'bimanual pelvic examination',
    'toque bimanual': 'bimanual pelvic examination',
    'toque bimanual ginecologico': 'bimanual pelvic examination',
    'exame de toque binomial': 'bimanual pelvic examination',
    'exame de toque bimanual': 'bimanual pelvic examination',
    'toque ginecologico bimanual': 'bimanual pelvic examination',
    'toque ginecológico bimanual': 'bimanual pelvic examination',
    'colecistite': 'cholecystitis',
    'colecistite aguda': 'acute cholecystitis',
    'pancreatite': 'pancreatitis',
    'pancreatite aguda': 'acute pancreatitis',
    'diverticulite': 'diverticulitis',
    'peritonite': 'peritonitis',
    'isquemia mesentérica': 'mesenteric ischemia',
    'isquemia mesenterica': 'mesenteric ischemia',
    'isquemia': 'ischemia',
    'esofagite': 'esophagitis',
    'gastrite': 'gastritis',
    'úlcera péptica': 'peptic ulcer',
    'ulcera peptica': 'peptic ulcer',
    'infarto agudo do miocárdio': 'acute myocardial infarction',
    'infarto agudo do miocardio': 'acute myocardial infarction',
    'infarto do miocardio': 'myocardial infarction',
    'ascite': 'ascites',
    'cirrose hepática': 'liver cirrhosis',
    'cirrose hepatica': 'liver cirrhosis',
    'cirrose': 'cirrhosis',
    'tuberculose': 'tuberculosis',
    'pneumonia': 'pneumonia',
    'derrame pleural': 'pleural effusion',
    'insuficiência cardíaca': 'heart failure',
    'insufiencia cardiaca': 'heart failure',
    'crise asmática': 'asthma attack',
    'crise asmatica': 'asthma attack',
    'asma': 'asthma',
    'embolia pulmonar': 'pulmonary embolism',
    'tromboembolismo pulmonar': 'pulmonary embolism',
    'trombose venosa profunda': 'deep vein thrombosis',
    'choque séptico': 'septic shock',
    'choque septico': 'septic shock',
    'sepse': 'sepsis',
    'infecção urinária': 'urinary tract infection',
    'infeccao urinaria': 'urinary tract infection',
    'meningite': 'meningitis',
    'meningite bacteriana': 'bacterial meningitis',
    'acidente vascular cerebral': 'stroke',
    'avc': 'stroke',
    'avc isquêmico': 'ischemic stroke',
    'avc isquemico': 'ischemic stroke',
    'avc hemorrágico': 'hemorrhagic stroke',
    'avc hemorragico': 'hemorrhagic stroke',
    'aneurisma': 'aneurysm',
    'hipertensão intracraniana': 'intracranial hypertension',
    'hipertensao intracraniana': 'intracranial hypertension',
    'cetoacidose diabética': 'diabetic ketoacidosis',
    'cetoacidose diabetica': 'diabetic ketoacidosis',
    'comissão': 'commission',
    'parto': 'childbirth',
    'parto normal': 'normal childbirth',
    'parto cesárea': 'cesarean delivery',
    'parto cesarea': 'cesarean delivery',
    'pré-eclâmpsia': 'preeclampsia',
    'pre-eclampsia': 'preeclampsia',
    'eclâmpsia': 'eclampsia',
    'eclampsia': 'eclampsia',
    'gravidez ectópica': 'ectopic pregnancy',
    'gravidez ectopica': 'ectopic pregnancy',
    'descolamento prematuro de placenta': 'placental abruption',
    'placenta prévia': 'placenta previa',
    'placenta previa': 'placenta previa',
    'atrésia': 'atresia',
    'estômago': 'stomach',
    'fígado': 'liver',
    'rins': 'kidneys',
    'rim': 'kidney',
    'pulmão': 'lung',
    'coracão': 'heart',
    'coração': 'heart',
    'bexiga': 'bladder',
    'baço': 'spleen',
    'baco': 'spleen',
    'pâncreas': 'pancreas',
    'pancreas': 'pancreas',
    'intestino': 'intestine',
    'apêndice': 'appendix',
    'apendice': 'appendix',
    'colpitis macularis': 'colpitis macularis',
    'colpitis': 'colpitis',
    'macularis': 'macularis',
    'colo em framboesa': 'strawberry cervix',
    'colo em morango': 'strawberry cervix',
    'framboesa': 'strawberry',
    'morango': 'strawberry',
    'tricomoníase': 'trichomoniasis',
    'tricomoniase': 'trichomoniasis',
    'candidíase': 'candidiasis',
    'candidiase': 'candidiasis',
    'reanimação neonatal': 'neonatal resuscitation',
    'reanimacao neonatal': 'neonatal resuscitation',
    'tomografia de crânio': 'brain ct scan',
    'tomografia de cranio': 'brain ct scan',
    'calcificações periventriculares': 'periventricular calcifications',
    'calcificacoes periventriculares': 'periventricular calcifications',
    'infecção por cmv': 'cmv infection cytomegalovirus',
    'infeccao por cmv': 'cmv infection cytomegalovirus',
    'ombro': 'shoulder',
    'manguito': 'rotator cuff',
    'manguito rotador': 'rotator cuff',
    'ruptura do manguito': 'rotator cuff tear',
    'ruptura do manguito rotador': 'rotator cuff tear',
    'lesão do manguito': 'rotator cuff injury',
    'lesão do manguito rotador': 'rotator cuff injury',
    'lesao do manguito rotador': 'rotator cuff injury',
    'ruptura de tendão': 'tendon tear',
    'ruptura do tendão': 'tendon tear',
    'ruptura do supraespinhal': 'supraspinatus tear',
    'tendão supraespinhal': 'supraspinatus tendon',
    'tendao supraespinhal': 'supraspinatus tendon',
    'tendinite supraespinhal': 'supraspinatus tendinitis',
    'artroscopia de ombro': 'shoulder arthroscopy',
    'artroscopia do ombro': 'shoulder arthroscopy',
    'artroscopia': 'arthroscopy',
    'âncora': 'suture anchor',
    'ancora': 'suture anchor',
    'âncora de sutura': 'suture anchor',
    'ancora de sutura': 'suture anchor',
    'sutura': 'suture',
    'sutura de tendão': 'tendon suture',
    'exame de imagem': 'medical scan image',
    'sinal clínico': 'clinical sign',
    'sinais clínicos': 'clinical signs',
    'sinal clinico': 'clinical sign',
    'sinais clinicos': 'clinical signs',
    'sinal': 'sign',
    'sinais': 'signs',
    'apresentação clínica': 'clinical presentation',
    'apresentacao clinica': 'clinical presentation',
    'fotografia clínica': 'clinical photograph',
    'fotografia clinica': 'clinical photograph',
    'foto clínica': 'clinical photograph',
    'foto clinica': 'clinical photograph',
    'clínica': 'clinical',
    'clinica': 'clinical',
    'clínico': 'clinical',
    'clinico': 'clinical',
    'imagem': 'image',
    'imagens': 'images',
    'sinal de murphy': 'murphy sign',
    'sinal de blumberg': 'blumberg sign',
    'sinal de giordano': 'giordano sign',
    'sinal de cullen': 'cullen sign',
    'sinal de grey turner': 'grey turner sign',
    'sinal de mcburney': 'mcburney sign',
    'sinal de rovsing': 'rovsing sign',
    'sinal de homans': 'homans sign',
    'sinal de babinski': 'babinski sign',
    'sinal de kernig': 'kernig sign',
    'sinal de brudzinski': 'brudzinski sign',
  };

  if (directMaps[text]) {
    return directMaps[text];
  }

  let translated = text;
  translated = translated.replace(/\bhiperplasia\b/g, 'hyperplasia');
  translated = translated.replace(/\bhipertrofia\b/g, 'hypertrophy');
  translated = translated.replace(/\bdisplasia\b/g, 'dysplasia');
  translated = translated.replace(/\bmetaplasia\b/g, 'metaplasia');
  translated = translated.replace(/\bneoplasia\b/g, 'neoplasia');
  translated = translated.replace(/\batipia\b|\batipias\b/g, 'atypia');
  translated = translated.replace(/\bcomplexa\b|\bcomplexo\b/g, 'complex');
  translated = translated.replace(/\bsimples\b/g, 'simple');
  translated = translated.replace(/\bespécime\b|\bespecime\b/g, 'specimen');
  translated = translated.replace(/\bcirúrgico\b|\bcirurgico\b/g, 'surgical');
  translated = translated.replace(/\bútero\b|\butero\b/g, 'uterus');
  translated = translated.replace(/\bovário\b|\bovario\b|\bovários\b|\bovarios\b/g, 'ovary');
  translated = translated.replace(/\bcolo\b/g, 'cervix');
  translated = translated.replace(/\bcâncer\b|\bcancer\b/g, 'cancer');
  translated = translated.replace(/\bpatologia\b/g, 'pathology');
  translated = translated.replace(/\bcolpitis\b/g, 'colpitis');
  translated = translated.replace(/\bmacularis\b/g, 'macularis');
  translated = translated.replace(/\bframboesa\b|\bmorango\b/g, 'strawberry');
  translated = translated.replace(/\btricomoníase\b|\btricomoniase\b/g, 'trichomoniasis');
  translated = translated.replace(/\bvaginose\b/g, 'vaginosis');
  translated = translated.replace(/\bcandidíase\b|\bcandidiase\b/g, 'candidiasis');
  translated = translated.replace(/\breanimação\b|\breanimacao\b/g, 'resuscitation');
  translated = translated.replace(/\bneonatal\b/g, 'neonatal');
  translated = translated.replace(/\bcrânio\b|\bcranio\b/g, 'brain skull');
  translated = translated.replace(/\bcalcificações\b|\bcalcificacoes\b|\bcalcificação\b|\bcalcificacao\b/g, 'calcifications');
  translated = translated.replace(/\bperiventriculares\b|\bperiventricular\b/g, 'periventricular');
  translated = translated.replace(/\binfecção\b|\binfeccao\b/g, 'infection');
  translated = translated.replace(/\bcaracterísticas\b|\bcaracteristicas\b/g, 'features');
  translated = translated.replace(/\bdemonstrando\b/g, 'showing');
  translated = translated.replace(/\bcmv\b/g, 'cmv cytomegalovirus');
  
  translated = translated.replace(/ite\bgrava\b/g, 'itis acute');
  translated = translated.replace(/ite\baguda\b/g, 'itis acute');
  translated = translated.replace(/ite\b/g, 'itis');
  translated = translated.replace(/ose\b/g, 'osis');
  translated = translated.replace(/mia\b/g, 'emia');
  translated = translated.replace(/doença\b|doenca\b/g, 'disease');
  translated = translated.replace(/insuficiência\b|insuficiencia\b/g, 'insufficiency');
  translated = translated.replace(/síndrome\b|sindrome\b/g, 'syndrome');
  translated = translated.replace(/\baguda\b|\bagudo\b/g, 'acute');
  translated = translated.replace(/\bcrônica\b|\bcrônico\b|\bcronica\b|\bcronico\b/g, 'chronic');
  translated = translated.replace(/\bgrave\b/g, 'severe');
  translated = translated.replace(/\bcoração\b|\bcoracão\b|\bcoracao\b/g, 'heart');
  translated = translated.replace(/\brim\b|\brins\b/g, 'kidney');
  translated = translated.replace(/\bfígado\b|\bfigado\b/g, 'liver');
  translated = translated.replace(/\bpulmão\b|\bpulmao\b/g, 'lung');
  translated = translated.replace(/\bestômago\b|\bestomago\b/g, 'stomach');
  translated = translated.replace(/\bbexiga\b/g, 'bladder');
  translated = translated.replace(/\bvaso\b|\bvasos\b/g, 'vascular');
  translated = translated.replace(/\bveia\b|\bveias\b/g, 'vein');
  translated = translated.replace(/\bartéria\b|\barteria\b|\bartérias\b|\barterias\b/g, 'artery');
  translated = translated.replace(/\bparto\b/g, 'delivery');
  translated = translated.replace(/\braio-x\b|\braio x\b|\braios x\b/g, 'x-ray');
  translated = translated.replace(/\btomografia\b/g, 'CT scan');
  translated = translated.replace(/\bressonância\b|\bressonancia\b/g, 'MRI');
  translated = translated.replace(/\bultrassom\b|\bultrassonografia\b/g, 'ultrasound');
  translated = translated.replace(/\bexame\b/g, 'medical scan');
  translated = translated.replace(/\bde\b|\bda\b|\bdo\b|\bcom\b/g, ' ');
  return translated.replace(/\s+/g, ' ').trim();
};

export const expandSearchTerms = (initialTerms: string[]): string[] => {
  const expanded: string[] = [];
  const visited = new Set<string>();

  const addTerm = (t: string) => {
    const cleaned = t.trim().replace(/\s+/g, ' ');
    if (cleaned.length >= 3 && !visited.has(cleaned.toLowerCase())) {
      visited.add(cleaned.toLowerCase());
      expanded.push(cleaned);
    }
  };

  // Add all initial terms first
  initialTerms.forEach(t => addTerm(t));

  // Add highly targeted academic variants in both languages
  initialTerms.forEach(term => {
    if (term.length >= 4) {
      const isEnglish = /^[a-zA-Z\s-_]+$/.test(term);
      if (isEnglish) {
        addTerm(`${term} textbook`);
        addTerm(`${term} atlas`);
        addTerm(`${term} case report`);
        addTerm(`${term} histology`);
        addTerm(`${term} diagram`);
        addTerm(`${term} anatomy`);
      } else {
        addTerm(`${term} livro`);
        addTerm(`${term} atlas`);
        addTerm(`${term} caso clinico`);
        addTerm(`${term} histologia`);
        addTerm(`${term} esquema`);
        addTerm(`${term} anatomia`);
      }
    }
  });

  // For each term, generate relaxed fallbacks
  initialTerms.forEach(term => {
    const stopWords = new Set([
      'of', 'the', 'in', 'with', 'on', 'and', 'a', 'an', 'at', 'by', 'for', 'from', 'to', 'using',
      'de', 'da', 'do', 'com', 'em', 'para', 'por', 'uma', 'um', 'nas', 'nos', 'na', 'no', 'dos', 'das',
      'is', 'are', 'was', 'were', 'or', 'about', 'vs', 'versus', 'vs.', 'contra'
    ]);
    
    const words = term.split(/\s+/).filter(w => w.length > 0);
    const filteredWords = words.filter(w => {
      const cleanW = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      return !stopWords.has(cleanW) && !stopWords.has(w.toLowerCase());
    });

    // 1. Stop words filtered version
    if (filteredWords.length > 0 && filteredWords.length < words.length) {
      addTerm(filteredWords.join(' '));
    }

    const targetWords = filteredWords.length > 0 ? filteredWords : words;
    
    // 2. Progressive truncation (first 2 words, first 3 words)
    if (targetWords.length > 1) {
      addTerm(targetWords.slice(0, 2).join(' '));
    }
    if (targetWords.length > 2) {
      addTerm(targetWords.slice(0, 3).join(' '));
    }
    if (targetWords.length > 3) {
      addTerm(targetWords.slice(0, 4).join(' '));
    }

    // 3. Keep highly selective medical nouns as individual terms
    const commonMedicalKeywords = [
      'syphilis', 'rubella', 'toxoplasmosis', 'cmv', 'herpes', 'hiv', 'hepatitis', 'zika',
      'appendicitis', 'cholecystitis', 'pancreatitis', 'diverticulitis', 'effusion',
      'pneumonia', 'tuberculosis', 'infarction', 'peptic', 'cirrhosis', 'ascites',
      'meningite', 'meningitis', 'erythema', 'rash', 'cataract', 'chorioretinitis',
      'calcification', 'microcephaly', 'hydrocephalus', 'abruption', 'preeclampsia',
      'syphilis', 'sifilis', 'sarampo', 'varicela', 'muffin', 'cervicitis', 'vaginitis',
      'cervicite', 'vaginite', 'vaginose', 'vaginosis', 'colpite', 'colpitis'
    ];
    const medicalSuffixRegex = /(itis|osis|opathy|pathia|oma|emia|cardia|pnea|uria|ology|pathy|asis)\b/i;
    targetWords.forEach(w => {
      const lower = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.length >= 4 && (commonMedicalKeywords.includes(lower) || medicalSuffixRegex.test(lower))) {
        addTerm(w);
      }
    });
  });

  return expanded;
};

const positiveKeywords = [
  'medicine', 'medical', 'clinical', 'anatomy', 'anatomical', 'pathology', 'pathological', 'disease', 'lesion', 'surgery', 'surgical', 
  'radiograph', 'radiography', 'radiology', 'ct scan', 'magnetic resonance', 'ultrasound', 'ultrasonography', 'echocardiography', 
  'endoscopy', 'microscopy', 'histology', 'histological', 'cytology', 'biopsy', 'hospital', 'health', 'infectious', 'infection', 
  'virus', 'viral', 'bacteria', 'bacterial', 'parasite', 'parasitic', 'fungus', 'fungal', 'syndrome', 'patient', 'doctor', 'nurse', 
  'clinic', 'womb', 'fetus', 'baby', 'childbirth', 'delivery', 'obstetrics', 'pediatric', 'pediatrics', 'vaccine', 'immunology', 
  'physiology', 'neurological', 'cardiac', 'gastrointestinal', 'lung', 'renal', 'hepatic', 'spleen', 'bone', 'muscle', 'joint', 
  'ophthalmology', 'cataract', 'retina', 'eyeball', 'skin', 'rash', 'erythema', 'dermatitis', 'mouth', 'oral', 'tooth', 'suture', 
  'incision', 'syringe', 'anesthesia', 'intubation', 'trauma', 'fracture', 'emergency', 'first aid', 'drug', 'medication', 
  'pharmacology', 'pill', 'tablet', 'capsule', 'syphilis', 'appendicitis', 'cholecystitis', 'pancreatitis', 'diverticulitis', 
  'effusion', 'pneumonia', 'tuberculosis', 'infarction', 'peptic', 'cirrhosis', 'ascites', 'meningitis', 'erythema', 'rash', 
  'cataract', 'chorioretinitis', 'calcification', 'microcephaly', 'hydrocephalus', 'abruption', 'preeclampsia', 'eclampsia', 
  'uterus', 'pregnancy', 'obstetric', 'gynecologic', 'gynecology', 'dissection', 'neoplasm', 'carcinoma', 'melanoma', 'hernias', 
  'urology', 'nephrology', 'cardiovascular', 'pulmonology', 'gastroenterology', 'oto', 'laryngology', 'rhinology', 'endocrine', 
  'lymph', 'hematology', 'neurology', 'brain disease', 'pulmonary', 'coronary', 'ecg', 'ekg', 'mr image', 'ct image', 'xray', 
  'radiological', 'myocardial', 'pleural', 'trachea', 'esophagus', 'stomach', 'duodenum', 'jejunum', 'ileum', 'colon', 'rectum', 
  'pancreas', 'gallbladder', 'biliary', 'bronchus', 'alveoli', 'cortex', 'skull', 'pelvis', 'femur', 'humerus', 'spine', 'vertebra',
  'hyperplasia', 'endometrium', 'endometrial', 'cervix', 'cervical', 'ovary', 'ovarian', 'uterine', 'histopathology', 'micrograph', 
  'atypia', 'atypical', 'hypertrophy', 'dysplasia', 'metaplasia', 'neoplasia', 'adenocarcinoma', 'sarcoma', 'gross', 'organ', 
  'tissue', 'epithelium', 'stroma', 'gland', 'glands', 'nodule', 'nodules', 'tumor', 'tumour', 'cyst', 'cysts', 'polyp', 'polyps',
  'discharge', 'leucorrhea', 'purulent', 'exudate', 'lesion', 'ulcer', 'vesicle', 'pustule', 'papule', 'macule', 'erythema',
  'colpitis', 'cervicitis', 'vaginitis', 'vulvovaginitis', 'pelvic', 'adnexal', 'adnexa', 'fallopian', 'tubal',
  'medicina', 'médico', 'médica', 'anatomia', 'patologia', 'doença', 'cirurgia', 'radiografia', 'diagnóstico', 'exame', 'paciente',
  'infecção', 'inflamação', 'parto', 'gravidez', 'vacina', 'trauma', 'hospitalar', 'clínico', 'clínica', 'úlcer', 'sutura'
];

const negativeKeywords = [
  'landmark', 'scenery', 'landscape', 'geography', 'village', 'town', 'city', 'street', 'highway', 'building', 'architecture',
  'sculpture', 'monument', 'statue', 'museum', 'flag', 'coat of arms', 'seal', 'logo', 'trademark', 'stamp', 'coin', 'currency',
  'map of', 'political map', 'topographic map', 'atlas', 'football', 'soccer', 'sport', 'athlete', 'stadium', 'car', 'automobile',
  'train', 'airplane', 'aircraft', 'aviation', 'ship', 'boat', 'weapon', 'military', 'army', 'politics', 'politician', 'election',
  'music', 'musical', 'concert', 'singer', 'album', 'movie', 'film', 'actor', 'television', 'tv show', 'fictional', 'novel',
  'poetry', 'painting of', 'drawing of', 'art museum', 'fashion', 'clothing', 'recipe', 'cuisine', 'dish', 'cooking', 'restaurant',
  'furniture', 'house', 'hotel', 'resort', 'beach', 'national park', 'mountain range', 'river', 'lake', 'waterfall', 'forest',
  'astronomy', 'galaxy', 'star', 'nebula', 'planet', 'mars', 'spacecraft', 'telescope', 'physics', 'chemistry',
  'mathematics', 'binomial', 'polynomial', 'equation', 'coefficient', 'theorem', 'formula', 'algebra', 'calculus', 'probability distribution', 'function graph', 'geometric', 'algebraic', 'computer', 'software', 'technology', 'gadget', 'smartphone', 'console', 'video game', 'toy', 'doll',
  'beverage', 'beer', 'wine', 'cocktail', 'coffee', 'tea', 'cafe', 'celebration', 'festival', 'holiday', 'birthday', 'wedding',
  'animal', 'mammal', 'bird', 'insect', 'fish', 'reptile', 'amphibian', 'plant', 'tree', 'flower', 'mountain', 'nature', 'wildlife',
  'dog', 'cat', 'horse', 'cow', 'sheep', 'pig', 'elk', 'deer', 'moose', 'lion', 'tiger', 'bear', 'jungle', 'ocean', 'sky', 'clouds',
  'sunset', 'sunrise', 'garden', 'park', 'grass', 'field', 'valley', 'rock formation', 'canyon', 'desert', 'volcano', 'fungus mushroom',
  'fauna', 'flora', 'scenic', 'hiking', 'alpine', 'summit', 'peak'
];

const clinicalSynonyms: Record<string, string[]> = {
  'colpitis': ['cervix', 'cervical', 'trichomonas', 'trichomoniasis', 'vaginitis', 'vagina', 'colpitis', 'macularis', 'strawberry', 'framboesa', 'morango', 'colposcopy'],
  'macularis': ['cervix', 'cervical', 'trichomonas', 'trichomoniasis', 'vaginitis', 'vagina', 'colpitis', 'macularis', 'strawberry', 'framboesa', 'morango', 'colposcopy'],
  'strawberry': ['cervix', 'cervical', 'trichomonas', 'trichomoniasis', 'vaginitis', 'vagina', 'colpitis', 'macularis', 'strawberry', 'framboesa', 'morango', 'colposcopy'],
  'cervix': ['cervix', 'cervical', 'trichomonas', 'trichomoniasis', 'vaginitis', 'vagina', 'colpitis', 'macularis', 'strawberry', 'framboesa', 'morango', 'colposcopy', 'uterus', 'uterine', 'ectopia', 'colposcopia'],
  'trichomoniasis': ['cervix', 'cervical', 'trichomonas', 'trichomoniasis', 'vaginitis', 'vagina', 'colpitis', 'macularis', 'strawberry', 'framboesa', 'morango', 'colposcopy', 'protozoan', 'trophozoite'],
  'trichomonas': ['cervix', 'cervical', 'trichomonas', 'trichomoniasis', 'vaginitis', 'vagina', 'colpitis', 'macularis', 'strawberry', 'framboesa', 'morango', 'colposcopy', 'protozoan', 'trophozoite'],
  'resuscitation': ['resuscitation', 'neonatal', 'newborn', 'infant', 'baby', 'bag', 'valve', 'mask', 'intubation', 'reanimacao', 'ventilator', 'bvm'],
  'neonatal': ['resuscitation', 'neonatal', 'newborn', 'infant', 'baby', 'bag', 'valve', 'mask', 'intubation', 'reanimacao', 'ventilator', 'bvm'],
  'newborn': ['resuscitation', 'neonatal', 'newborn', 'infant', 'baby', 'bag', 'valve', 'mask', 'intubation', 'reanimacao', 'ventilator', 'bvm'],
  'ascite': ['ascites', 'paracentesis', 'cirrhosis', 'liver', 'abdomen', 'ascitico', 'ascite', 'fluid'],
  'ascites': ['ascites', 'paracentesis', 'cirrhosis', 'liver', 'abdomen', 'ascitico', 'ascite', 'fluid'],
  'pleural': ['pleural', 'effusion', 'lung', 'thorax', 'thoracentesis', 'x-ray', 'chest', 'pneumonia'],
  'effusion': ['pleural', 'effusion', 'lung', 'thorax', 'thoracentesis', 'x-ray', 'chest', 'pneumonia'],
  'vaginose': ['vaginosis', 'gardnerella', 'clue', 'cells', 'vagina', 'vaginal', 'discharge', 'cluecells', 'mobiluncus'],
  'vaginosis': ['vaginosis', 'gardnerella', 'clue', 'cells', 'vagina', 'vaginal', 'discharge', 'cluecells', 'mobiluncus'],
  'candidíase': ['candidiasis', 'candida', 'yeast', 'infection', 'vagina', 'vaginal', 'discharge', 'hyphae', 'spores', 'moniliasis', 'monilia'],
  'candidiasis': ['candidiasis', 'candida', 'yeast', 'infection', 'vagina', 'vaginal', 'discharge', 'hyphae', 'spores', 'moniliasis', 'monilia'],
  'corrimento': ['discharge', 'leucorrhea', 'leucorreia', 'vaginal', 'cervical', 'mucopurulent', 'purulent', 'yellowish', 'greenish'],
  'discharge': ['discharge', 'leucorrhea', 'leucorreia', 'vaginal', 'cervical', 'mucopurulent', 'purulent', 'yellowish', 'greenish'],
  'leucorreia': ['discharge', 'leucorrhea', 'leucorreia', 'vaginal', 'cervical', 'mucopurulent', 'purulent', 'yellowish', 'greenish'],
  'leucorrhea': ['discharge', 'leucorrhea', 'leucorreia', 'vaginal', 'cervical', 'mucopurulent', 'purulent', 'yellowish', 'greenish'],
  'ectópica': ['ectopic', 'pregnancy', 'tubal', 'uterus', 'adnexal', 'ovary', 'fallopian'],
  'ectopic': ['ectopic', 'pregnancy', 'tubal', 'uterus', 'adnexal', 'ovary', 'fallopian'],
  'placenta': ['placenta', 'abruption', 'previa', 'praevia', 'pregnancy', 'obstetric', 'bleeding', 'uterus', 'uterine'],
  'abruption': ['placenta', 'abruption', 'previa', 'praevia', 'pregnancy', 'obstetric', 'bleeding', 'uterus', 'uterine'],
  'previa': ['placenta', 'abruption', 'previa', 'praevia', 'pregnancy', 'obstetric', 'bleeding', 'uterus', 'uterine'],
  'hyperplasia': ['hyperplasia', 'endometrium', 'endometrial', 'atypia', 'atypical', 'uterus', 'uterine', 'micrograph', 'gland', 'glands', 'stroma'],
  'endometrial': ['hyperplasia', 'endometrium', 'endometrial', 'atypia', 'atypical', 'uterus', 'uterine', 'micrograph', 'gland', 'glands', 'stroma'],
  'endometrium': ['hyperplasia', 'endometrium', 'endometrial', 'atypia', 'atypical', 'uterus', 'uterine', 'micrograph', 'gland', 'glands', 'stroma'],
  'cmv': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'cytomegalovirus': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'calcification': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'calcifications': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'calcificações': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'calcificacoes': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'periventricular': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'periventriculares': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'ct': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'tomography': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'tomografia': ['ct', 'scan', 'tomography', 'computed', 'calcification', 'calcifications', 'periventricular', 'brain', 'skull', 'head', 'microcephaly', 'cytomegalovirus', 'cmv', 'congenital'],
  'shoulder': ['shoulder', 'humerus', 'glenoid', 'acromion', 'rotator', 'cuff', 'supraspinatus', 'ombro'],
  'rotator': ['rotator', 'cuff', 'shoulder', 'supraspinatus', 'tendon', 'manguito', 'rotador'],
  'cuff': ['rotator', 'cuff', 'shoulder', 'supraspinatus', 'tendon', 'manguito', 'rotador'],
  'manguito': ['rotator', 'cuff', 'shoulder', 'supraspinatus', 'tendon', 'manguito', 'rotador'],
  'rotador': ['rotator', 'cuff', 'shoulder', 'supraspinatus', 'tendon', 'manguito', 'rotador'],
  'ombro': ['shoulder', 'humerus', 'glenoid', 'acromion', 'rotator', 'cuff', 'supraspinatus', 'ombro'],
  'ruptura': ['rupture', 'tear', 'lesion', 'injury', 'fracture', 'ruptura', 'rotura'],
  'rotura': ['rupture', 'tear', 'lesion', 'injury', 'fracture', 'ruptura', 'rotura'],
  'tear': ['rupture', 'tear', 'lesion', 'injury', 'fracture', 'ruptura', 'rotura'],
  'tendao': ['tendon', 'supraspinatus', 'biceps', 'tendão', 'tendao'],
  'tendão': ['tendon', 'supraspinatus', 'biceps', 'tendão', 'tendao'],
  'tendon': ['tendon', 'supraspinatus', 'biceps', 'tendão', 'tendao'],
  'sutura': ['suture', 'repair', 'anchor', 'surgery', 'sutura'],
  'suture': ['suture', 'repair', 'anchor', 'surgery', 'sutura'],
  'ancora': ['anchor', 'suture', 'repair', 'âncora', 'ancora'],
  'âncora': ['anchor', 'suture', 'repair', 'âncora', 'ancora'],
  'anchor': ['anchor', 'suture', 'repair', 'âncora', 'ancora'],
  'artroscopia': ['arthroscopy', 'arthroscopic', 'probe', 'shoulder', 'joint', 'artroscopia'],
  'arthroscopy': ['arthroscopy', 'arthroscopic', 'probe', 'shoulder', 'joint', 'artroscopia'],
  'sinal': ['sign', 'symptom', 'presentation', 'clinical', 'sinal', 'sinais'],
  'sinais': ['signs', 'symptoms', 'presentation', 'clinical', 'sinal', 'sinais'],
  'sign': ['sign', 'symptom', 'presentation', 'clinical', 'sinal', 'sinais'],
  'signs': ['signs', 'symptoms', 'presentation', 'clinical', 'sinal', 'sinais'],
  'clinical': ['clinical', 'medical', 'patient', 'presentation', 'clínica', 'clínico', 'clinica', 'clinico'],
  'photo': ['photo', 'photograph', 'clinical', 'patient', 'presentation', 'imagem', 'imagens'],
  'photograph': ['photo', 'photograph', 'clinical', 'patient', 'presentation', 'imagem', 'imagens'],
  'ultrasound': ['ultrasound', 'ultrasonography', 'echography', 'ultrassom', 'ultrassonografia'],
  'ultrassom': ['ultrasound', 'ultrasonography', 'echography', 'ultrassom', 'ultrassonografia'],
  'bimanual': ['bimanual', 'pelvic', 'palpation', 'examination', 'gynaecology', 'gynecology', 'gynecologic', 'cervix', 'uterus', 'vagina'],
  'pelvic': ['pelvic', 'palpation', 'examination', 'bimanual', 'gynaecology', 'gynecology', 'gynecologic', 'cervix', 'uterus', 'vagina']
};

const isSemanticallyRelevant = (title: string, categories: string[], queryTerm: string): boolean => {
  if (!queryTerm) return true;
  
  const cleanQuery = queryTerm.toLowerCase().trim();
  const cleanTitle = title.toLowerCase();
  const lowerCats = categories.map(c => c.toLowerCase());
  
  // Split query into individual words, ignoring small words like 'of', 'the', 'and', 'in', 'a', 'an', 'to', 'for', 'with', 'by'
  const stopWords = ['of', 'the', 'and', 'in', 'a', 'an', 'to', 'for', 'with', 'by', 'on', 'at', 'from', 's', 'scan', 'image', 'file', 'vs', 'versus', 'contra'];
  const queryWords = cleanQuery
    .split(/[\s-_]+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 2 && !stopWords.includes(w));
    
  if (queryWords.length === 0) return true; // If no significant words, fall back to true
  
  // 1. Direct match check
  const matchedInTitle = queryWords.some(word => cleanTitle.includes(word));
  const matchedInCats = queryWords.some(word => lowerCats.some(cat => cat.includes(word)));
  if (matchedInTitle || matchedInCats) return true;

  // 2. Clinical synonyms check
  for (const word of queryWords) {
    const synonyms = clinicalSynonyms[word];
    if (synonyms) {
      const anySynonymMatchedInTitle = synonyms.some(syn => cleanTitle.includes(syn));
      const anySynonymMatchedInCats = synonyms.some(syn => lowerCats.some(cat => cat.includes(syn)));
      if (anySynonymMatchedInTitle || anySynonymMatchedInCats) {
        console.log(`[Validation] Approved candidate via clinical synonym match for "${word}": synonyms [${synonyms.join(', ')}] matched in title or categories`);
        return true;
      }
    }
  }
  
  return false;
};

export const isCertifiedMedicalImage = (cand: any, isDirectQuery: boolean, queryTerm?: string): boolean => {
  if (!cand) return false;
  
  const title = (cand.title || '').toLowerCase();
  const url = (cand.imageinfo?.[0]?.url || '').toLowerCase();
  const categories = (cand.categories || []).map((c: any) => (c.title || '').toLowerCase());
  
  const cleanTitle = title.replace(/^file:/, '');

  // 1. Strict negative check
  for (const neg of negativeKeywords) {
    if (cleanTitle.includes(neg)) {
      console.log(`[Validation] Rejected candidate "${title}" due to negative title keyword "${neg}"`);
      return false;
    }
    for (const cat of categories) {
      if (cat.includes(neg)) {
        console.log(`[Validation] Rejected candidate "${title}" due to negative category "${cat}" containing "${neg}"`);
        return false;
      }
    }
  }

  // 2. Strict semantic relevance check (if queryTerm is provided)
  if (queryTerm && !isSemanticallyRelevant(cleanTitle, categories, queryTerm)) {
    console.log(`[Validation] Rejected candidate "${title}" due to failure of semantic relevance check for "${queryTerm}"`);
    return false;
  }

  // 3. Strict positive category match
  let hasPositiveCategory = false;
  let matchedCat = '';
  for (const pos of positiveKeywords) {
    for (const cat of categories) {
      if (cat.includes(pos)) {
        hasPositiveCategory = true;
        matchedCat = cat;
        break;
      }
    }
    if (hasPositiveCategory) break;
  }

  if (hasPositiveCategory) {
    console.log(`[Validation] Approved candidate "${title}" via positive category "${matchedCat}"`);
    return true;
  }

  // 4. Positive title pattern match
  let hasPositiveTitlePattern = false;
  for (const pos of positiveKeywords) {
    if (cleanTitle.includes(pos) || url.includes(pos)) {
      hasPositiveTitlePattern = true;
      console.log(`[Validation] Approved candidate "${title}" via positive keyword "${pos}" in title/url`);
      break;
    }
  }

  if (hasPositiveTitlePattern) {
    return true;
  }

  const medicalSuffixRegex = /(itis|osis|opathy|pathia|oma|emia|cardia|pnea|uria|_scan|radiograph|dissection|biopsy|ultrasound)\b/i;
  if (medicalSuffixRegex.test(cleanTitle)) {
    console.log(`[Validation] Approved candidate "${title}" via medical suffix regex`);
    return true;
  }

  // 5. Fallback for direct specific filenames (e.g., congenital_cataract.jpg) without negative tags
  if (isDirectQuery) {
    console.log(`[Validation] Permitted candidate "${title}" on direct query (no negative violations)`);
    return true;
  }

  console.log(`[Validation] Rejected candidate "${title}" on search fallback (no validated medical indicators found)`);
  return false;
};

export const scoreMedicalCandidate = (cand: any, queryTerm?: string): number => {
  if (!cand) return 0;
  
  const title = (cand.title || '').toLowerCase();
  const categories = (cand.categories || []).map((c: any) => (c.title || '').toLowerCase());
  const cleanTitle = title.replace(/^file:/, '');
  const url = (cand.imageinfo?.[0]?.url || '').toLowerCase();
  
  let score = 0;
  
  // High value words suggesting medical textbooks, atlases, journals, dissections, micrographs
  const highValueTerms = [
    'textbook', 'book', 'atlas', 'journal', 'case report', 'nejm', 'lancet', 'dissection', 
    'micrograph', 'histology', 'histopathology', 'pathology', 'radiograph', 'radiography', 
    'ct scan', 'magnetic resonance', 'mri', 'ultrasound', 'diagram', 'illustration', 
    'clinical photograph', 'gross pathology', 'scientific', 'treatise', 'clinical image',
    'medical illustration', 'grey\'s anatomy', 'clinical case', 'uptodate', 'radiopaedia',
    'dermnet', 'bates guide', 'williams gynecology', 'harrison\'s principles'
  ];
  
  for (const term of highValueTerms) {
    if (cleanTitle.includes(term) || url.includes(term)) {
      score += 15; // Major boost for textbook/anatomy files
    }
    for (const cat of categories) {
      if (cat.includes(term)) {
        score += 8;
      }
    }
  }

  // Suffix/Prefix terms in Portuguese/Spanish suggesting books/cases
  const ptHighValueTerms = [
    'livro', 'tratado', 'artigo', 'revista científica', 'revista cientifica', 'caso clínico', 
    'caso clinico', 'atlas médico', 'atlas medico', 'anatomia', 'esquema', 'diagrama'
  ];
  for (const term of ptHighValueTerms) {
    if (cleanTitle.includes(term)) {
      score += 12;
    }
    for (const cat of categories) {
      if (cat.includes(term)) {
        score += 6;
      }
    }
  }

  // Evaluate extmetadata for highly prestigious peer-reviewed academic journals and medical textbooks
  const ext = cand.imageinfo?.[0]?.extmetadata;
  if (ext) {
    const extValues: string[] = [];
    if (ext.Source?.value) extValues.push(ext.Source.value.toLowerCase());
    if (ext.Artist?.value) extValues.push(ext.Artist.value.toLowerCase());
    if (ext.Credit?.value) extValues.push(ext.Credit.value.toLowerCase());
    if (ext.Description?.value) extValues.push(ext.Description.value.toLowerCase());
    
    const academicSources = [
      'plos', 'pmc', 'pubmed', 'biomed central', 'bmc', 'lancet', 'nejm', 'elsevier', 
      'springer', 'hindawi', 'nature', 'science', 'mdpi', 'frontiers in', 'journal of',
      'clinical case', 'case report', 'textbook', 'medical book', 'anatomia de gray', 'gray\'s anatomy',
      'clinical photograph', 'gross pathology', 'histopathology', 'micrograph', 'fig.', 'figure',
      'livro', 'tratado', 'artigo', 'revista', 'universidade', 'university', 'clinical photo',
      'colposcopy', 'gynecology', 'gynaecology', 'cervicitis', 'cervix', 'vaginitis', 'sobotta',
      'netter', 'moore', 'guyton', 'robbins', 'junqueira', 'sciencedirect', 'scielo', 'cochrane',
      'jama', 'bmj', 'researchgate', 'uptodate', 'radiopaedia', 'dermnet', 'medscape', 'statpearls'
    ];
    
    for (const source of academicSources) {
      if (extValues.some(val => val.includes(source))) {
        score += 35; // Huge boost for certified/verified academic sources in extmetadata!
      }
    }
  }

  // Exact match with clinical query term
  if (queryTerm) {
    const cleanQuery = queryTerm.toLowerCase().trim();
    if (cleanTitle.includes(cleanQuery)) {
      score += 25;
    }
    
    // Color matching boost
    const colors = ['yellow', 'green', 'red', 'white', 'black', 'blue', 'brown', 'purulent', 'clear', 'amarelo', 'verde', 'vermelho', 'branco', 'preto', 'azul', 'marrom'];
    const queryColors = colors.filter(c => cleanQuery.includes(c));
    for (const color of queryColors) {
      if (cleanTitle.includes(color) || url.includes(color)) {
        score += 30; // High boost for matching visual color descriptors
      }
    }

    for (const cat of categories) {
      if (cat.includes(cleanQuery)) {
        score += 15;
      }
    }
  }

  return score;
};

export const getBestMedicalImageCandidate = (candidates: any[], queryTerm: string): string | null => {
  if (!candidates || candidates.length === 0) return null;
  
  const certifiedCandidates = candidates
    .filter(cand => {
      const url = cand.imageinfo?.[0]?.url;
      if (!url) return false;
      return /\.(jpg|jpeg|png|gif|svg|webp)/i.test(url) && isCertifiedMedicalImage(cand, false, queryTerm);
    })
    .map(cand => ({
      url: cand.imageinfo[0].url,
      score: scoreMedicalCandidate(cand, queryTerm)
    }))
    .sort((a, b) => b.score - a.score);
    
  if (certifiedCandidates.length > 0) {
    return certifiedCandidates[0].url;
  }
  
  // Non-certified fallback (strict filtering of negative terms only, and must have a positive medical score)
  const nonViolationCandidates = candidates
    .filter(cand => {
      const url = cand.imageinfo?.[0]?.url;
      if (!url) return false;
      const title = (cand.title || '').toLowerCase();
      const categories = (cand.categories || []).map((c: any) => (c.title || '').toLowerCase());
      const cleanTitle = title.replace(/^file:/, '');
      
      for (const neg of negativeKeywords) {
        if (cleanTitle.includes(neg)) return false;
        for (const cat of categories) {
          if (cat.includes(neg)) return false;
        }
      }
      return /\.(jpg|jpeg|png|gif|svg|webp)/i.test(url);
    })
    .map(cand => ({
      url: cand.imageinfo[0].url,
      score: scoreMedicalCandidate(cand, queryTerm)
    }))
    .filter(cand => cand.score > 0) // Strictly require some medical keyword / suffix match
    .sort((a, b) => b.score - a.score);
    
  return nonViolationCandidates.length > 0 ? nonViolationCandidates[0].url : null;
};

const MarkdownImage = ({ src, alt, ...props }: any) => {
  const storageKey = `img_override_${encodeURIComponent(src)}`;
  const [overrideState, setOverrideState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualPreviewUrl, setManualPreviewUrl] = useState('');
  const [manualPreviewStatus, setManualPreviewStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        setOverrideState(saved ? JSON.parse(saved) : null);
      } catch {
        // ignore
      }
    };
    window.addEventListener('image-override-updated', handleUpdate);
    return () => {
      window.removeEventListener('image-override-updated', handleUpdate);
    };
  }, [src, storageKey]);

  const effectiveSrc = overrideState?.url || src;

  // Clean pure text for query searching
  const cleanAlt = alt ? alt.replace(/fonte:\s*.*|source:\s*.*|\[.*\]/gi, '').trim() : "Imagem Médica";
  
  // Clean source indication
  let sourceText = "";
  if (alt && alt.toLowerCase().includes("fonte:")) {
    const match = alt.match(/fonte:\s*([^\)]*)/i);
    if (match && match[1]) sourceText = match[1].trim();
  }

  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    let trimmed = url.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
    
    // Protocol-relative (startsWith '//')
    if (trimmed.startsWith('//')) {
      trimmed = `https:${trimmed}`;
    } else if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    // Convert thumbnail URLs to original files of high quality to bypass 400 bad requests
    if (trimmed.includes('wikimedia.org') || trimmed.includes('wikipedia.org')) {
      if (trimmed.includes('/wikipedia/commons/thumb/')) {
        const parts = trimmed.split('/');
        const thumbIndex = parts.indexOf('thumb');
        if (thumbIndex !== -1 && parts.length > thumbIndex + 3) {
          const upToThumb = parts.slice(0, thumbIndex);
          const nextThree = parts.slice(thumbIndex + 1, thumbIndex + 4);
          trimmed = [...upToThumb, ...nextThree].join('/');
        }
      }
    }
    
    return trimmed;
  };

  const getProxiedUrl = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
    if (trimmed.startsWith('/api/proxy-image')) return trimmed;
    
    const normalized = normalizeUrl(trimmed);
    
    // Use server proxy for external images in web environment
    if (typeof window !== 'undefined' && /^https?:\/\//i.test(normalized)) {
      return `/api/proxy-image?url=${encodeURIComponent(normalized)}`;
    }
    return normalized;
  };

  const getOriginalUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('/api/proxy-image')) {
      try {
        const urlObj = new URL(url, window.location.origin);
        const target = urlObj.searchParams.get('url');
        if (target) return target;
      } catch (e) {
        // Fallback
      }
    }
    return url;
  };

  const [currentSrc, setCurrentSrc] = useState(() => getProxiedUrl(effectiveSrc));
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAttemptingHeal, setIsAttemptingHeal] = useState(false);
  const [healed, setHealed] = useState(false);
  const [triedCasingSwap, setTriedCasingSwap] = useState(false);

  // Dynamic scientific metadata state
  const [metadata, setMetadata] = useState<{ artist?: string; source?: string; license?: string; licenseUrl?: string; credit?: string } | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const url = getOriginalUrl(currentSrc);
    if (!url || (!url.includes('wikimedia.org') && !url.includes('wikipedia.org'))) {
      setMetadata(null);
      return;
    }

    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split('/');
      let filename = parts[parts.length - 1];
      
      if (url.includes('/thumb/')) {
        const thumbIndex = parts.indexOf('thumb');
        if (thumbIndex !== -1 && parts.length > thumbIndex + 3) {
          filename = parts[thumbIndex + 3];
        } else if (parts.length > 2) {
          filename = parts[parts.length - 2];
        }
      }
      filename = filename.split('?')[0];

      if (filename && filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|svg|webp)/)) {
        setIsMetadataLoading(true);
        fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`)
          .then(res => res.json())
          .then(data => {
            if (!active) return;
            const pages = data.query?.pages;
            if (pages) {
              const pageId = Object.keys(pages)[0];
              const cand = pages[pageId];
              const ext = cand?.imageinfo?.[0]?.extmetadata;
              if (ext) {
                const stripHtml = (val: string) => {
                  if (!val) return '';
                  return val.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                };
                
                setMetadata({
                  artist: stripHtml(ext.Artist?.value || ''),
                  source: stripHtml(ext.Source?.value || ''),
                  license: stripHtml(ext.LicenseShortName?.value || ''),
                  licenseUrl: ext.LicenseUrl?.value || '',
                  credit: stripHtml(ext.Credit?.value || '')
                });
              } else {
                setMetadata(null);
              }
            }
          })
          .catch(err => {
            console.warn("[Metadata-Fetch] Failed to fetch extmetadata:", err);
          })
          .finally(() => {
            if (active) setIsMetadataLoading(false);
          });
      }
    } catch (e) {
      console.warn("[Metadata-Fetch] Error parsing filename:", e);
    }

    return () => {
      active = false;
    };
  }, [currentSrc]);

  // States for cycling alternatives when requested
  const [alternativeUrls, setAlternativeUrls] = useState<string[]>([]);
  const [altIndex, setAltIndex] = useState<number>(-1);
  const [isSearchingAlternatives, setIsSearchingAlternatives] = useState<boolean>(false);
  const [hasSearchedAlternatives, setHasSearchedAlternatives] = useState<boolean>(false);

  const loadAlternatives = async () => {
    if (isSearchingAlternatives) return;
    setIsSearchingAlternatives(true);
    
    try {
      const currentUrl = currentSrc || effectiveSrc || '';
      const originalUrl = getOriginalUrl(currentUrl);
      const decoded = decodeURIComponent(originalUrl);
      const parts = decoded.split('/');
      let filename = parts[parts.length - 1] || '';
      
      // Strip any trailing thumbnails parameters if present
      if (originalUrl.includes('/thumb/') || currentUrl.includes('/thumb/')) {
        const thumbIndex = parts.indexOf('thumb');
        if (thumbIndex !== -1 && parts.length > thumbIndex + 3) {
          filename = parts[thumbIndex + 3];
        } else if (parts.length > 2) {
          filename = parts[parts.length - 2];
        }
      }
      filename = filename.split('?')[0];

      const termFilename = filename
        .replace(/\.[a-zA-Z0-9]+$/, '') // remove extension
        .replace(/[-_]/g, ' ')          // dashes/underscores to spaces
        .replace(/\s+\d+$/, '')        // remove trailing numbers
        .trim();
        
      let baseSearchTerms: string[] = [];
      if (termFilename && termFilename.length > 3 && !termFilename.toLowerCase().match(/\.(jpg|jpeg|png|gif|svg|webp)/)) {
        baseSearchTerms.push(termFilename);
      }
      
      if (cleanAlt && cleanAlt !== "Imagem Médica" && cleanAlt.length > 3) {
        if (!baseSearchTerms.includes(cleanAlt)) {
          baseSearchTerms.push(cleanAlt);
        }
        const translatedAlt = getEnglishMedicalTerm(cleanAlt);
        if (translatedAlt && translatedAlt.length > 3 && !baseSearchTerms.includes(translatedAlt)) {
          baseSearchTerms.push(translatedAlt);
        }
      }
      
      if (termFilename && termFilename.length > 4) {
        const translatedFilename = getEnglishMedicalTerm(termFilename);
        if (translatedFilename && translatedFilename.length > 3 && !baseSearchTerms.includes(translatedFilename)) {
          baseSearchTerms.push(translatedFilename);
        }
      }
      
      const searchTerms = expandSearchTerms(baseSearchTerms);
      console.log("[Alternative-Search] Formulated search terms:", searchTerms);
      
      const foundUrlsMap = new Map<string, { certified: boolean; title: string; score: number }>();
      
      // Include current image URL first
      if (originalUrl && originalUrl.startsWith('http')) {
        foundUrlsMap.set(originalUrl, { certified: true, title: "Imagem Atual", score: 10 });
      }

      for (const queryTerm of searchTerms.slice(0, 3)) { // Top 3 terms
        if (!queryTerm || queryTerm.length < 3) continue;
        try {
          const searchRes = await fetch(
            `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(queryTerm)}&gsrnamespace=6&prop=imageinfo|categories&cllimit=15&iiprop=url|extmetadata&gsrlimit=12&format=json&origin=*`
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const pages = searchData.query?.pages;
            if (pages) {
              const candidates = Object.values(pages) as any[];
              for (const cand of candidates) {
                const url = cand.imageinfo?.[0]?.url;
                if (url && (
                  url.toLowerCase().endsWith('.jpg') || 
                  url.toLowerCase().endsWith('.jpeg') || 
                  url.toLowerCase().endsWith('.png') || 
                  url.toLowerCase().endsWith('.gif') || 
                  url.toLowerCase().endsWith('.svg') || 
                  url.toLowerCase().endsWith('.webp')
                )) {
                  const title = (cand.title || '').toLowerCase();
                  const categories = (cand.categories || []).map((c: any) => (c.title || '').toLowerCase());
                  const cleanTitle = title.replace(/^file:/, '');
                  
                  let hasNegativeViolation = false;
                  for (const neg of negativeKeywords) {
                    if (cleanTitle.includes(neg)) {
                      hasNegativeViolation = true;
                      break;
                    }
                    for (const cat of categories) {
                      if (cat.includes(neg)) {
                        hasNegativeViolation = true;
                        break;
                      }
                    }
                  }
                  
                  if (!hasNegativeViolation) {
                    const certified = isCertifiedMedicalImage(cand, false, queryTerm);
                    const score = scoreMedicalCandidate(cand, queryTerm);
                    if (certified || score > 0) {
                      foundUrlsMap.set(url, { certified, title: cand.title || '', score });
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn("[Alternative-Search] Error fetching for", queryTerm, err);
        }
      }

      // Query Open-i for clinical figures & atlas images
      const primaryQ = searchTerms[0] || termFilename || cleanAlt || 'medicine';
      try {
        const oiRes = await fetch(`/api/proxy-scientific?source=openi&query=${encodeURIComponent(primaryQ)}&limit=15`);
        if (oiRes.ok) {
          const oiData = await oiRes.json();
          if (oiData.list && Array.isArray(oiData.list)) {
            oiData.list.forEach((item: any) => {
              const url = item.imgLarge || item.imgThumb;
              if (url && url.startsWith('http')) {
                foundUrlsMap.set(url, { certified: true, title: item.title || 'Open-i NLM Clinical Case', score: 100 });
              }
            });
          }
        }
      } catch (oiErr) {
        console.warn("[Alternative-Search] Open-i fetch failed", oiErr);
      }

      // Query Internet Archive for Medical Books & Atlases
      try {
        const iaRes = await fetch(`/api/proxy-scientific?source=internetarchive&query=${encodeURIComponent(primaryQ)}&limit=10`);
        if (iaRes.ok) {
          const iaData = await iaRes.json();
          if (iaData.docs && Array.isArray(iaData.docs)) {
            iaData.docs.forEach((item: any) => {
              if (item.identifier) {
                const coverUrl = `https://archive.org/services/img/${item.identifier}`;
                foundUrlsMap.set(coverUrl, { certified: true, title: item.title || 'Livro de Medicina (Internet Archive)', score: 95 });
              }
            });
          }
        }
      } catch (iaErr) {
        console.warn("[Alternative-Search] IA fetch failed", iaErr);
      }
      
      // Convert and sort: certified first, then score descending
      const sortedCandidates = Array.from(foundUrlsMap.entries()).map(([url, info]) => ({
        url,
        ...info
      })).sort((a, b) => {
        if (a.certified && !b.certified) return -1;
        if (!a.certified && b.certified) return 1;
        return b.score - a.score;
      });
      
      const urls = sortedCandidates.map(c => c.url);
      setAlternativeUrls(urls);
      setHasSearchedAlternatives(true);
      
      if (urls.length > 0) {
        const matchIdx = urls.indexOf(originalUrl);
        if (matchIdx !== -1) {
          if (hasError && urls.length > 1) {
            const nextIdx = (matchIdx + 1) % urls.length;
            setAltIndex(nextIdx);
            setCurrentSrc(getProxiedUrl(urls[nextIdx]));
            setHasError(false);
            setIsLoading(true);
          } else {
            setAltIndex(matchIdx);
          }
        } else {
          setAltIndex(0);
          setCurrentSrc(getProxiedUrl(urls[0]));
          setHasError(false);
          setIsLoading(true);
        }
      }
    } catch (err) {
      console.warn("[Alternative-Search] Failed loading alternatives:", err);
    } finally {
      setIsSearchingAlternatives(false);
    }
  };

  const handleCycleImage = () => {
    if (!hasSearchedAlternatives) {
      loadAlternatives();
    } else if (alternativeUrls.length > 1) {
      const nextIdx = (altIndex + 1) % alternativeUrls.length;
      setAltIndex(nextIdx);
      setCurrentSrc(getProxiedUrl(alternativeUrls[nextIdx]));
      setHasError(false);
      setIsLoading(true);
    }
  };

  // Sync if src or override changes
  useEffect(() => {
    const proxied = getProxiedUrl(effectiveSrc);
    setCurrentSrc(proxied);
    setHasError(false);
    setIsLoading(true);
    setIsAttemptingHeal(false);
    setHealed(false);
    setTriedCasingSwap(false);
    setAlternativeUrls([]);
    setAltIndex(-1);
    setHasSearchedAlternatives(false);
  }, [effectiveSrc]);

  const handleImageError = async () => {
    const currentUrl = currentSrc || effectiveSrc || '';
    const originalUrl = getOriginalUrl(currentUrl);
    // Identify if it's a Wikimedia Commons image candidate (never classify base64 or blob or user override as Wikimedia)
    const isWikimedia = 
      !currentUrl.startsWith('data:') &&
      !currentUrl.startsWith('blob:') &&
      !overrideState?.url &&
      (
        originalUrl.includes('wikimedia.org') || 
        originalUrl.includes('wikipedia.org') || 
        currentUrl.includes('wikimedia.org') || 
        currentUrl.includes('wikipedia.org')
      );

    // If we tried loading the proxy url, and it failed, let's try the direct original url!
    if (currentUrl.startsWith('/api/proxy-image') && originalUrl && originalUrl !== currentUrl) {
      console.log(`[Auto-Heal] Proxy failed. Trying direct original URL: ${originalUrl}`);
      setCurrentSrc(originalUrl);
      return;
    }

    // Quick casing / extension heal first
    if (!triedCasingSwap && isWikimedia && originalUrl) {
      const swapped = originalUrl.replace(/\.([A-Z0-9]+)(\?|$)/, (_, ext, query) => `.${ext.toLowerCase()}${query}`);
      if (swapped !== originalUrl) {
        setTriedCasingSwap(true);
        console.log(`[Auto-Heal] Swapping extension to lowercase as quick heal: ${swapped}`);
        setCurrentSrc(getProxiedUrl(swapped));
        return;
      }
    }

    // If we already tried searching / healing once, don't loop endlessly
    if (isAttemptingHeal || healed) {
      setHasError(true);
      setIsLoading(false);
      return;
    }
    
    if (isWikimedia) {
      setIsAttemptingHeal(true);
      try {
        // Extract filename from the URL path
        const decoded = decodeURIComponent(originalUrl || currentUrl);
        const parts = decoded.split('/');
        let filename = parts[parts.length - 1];
        
        // Strip any trailing thumbnails parameters if present
        if (originalUrl.includes('/thumb/') || currentUrl.includes('/thumb/')) {
          // If it's a thumb URL, the filename is usually at thumbIndex + 3
          const thumbIndex = parts.indexOf('thumb');
          if (thumbIndex !== -1 && parts.length > thumbIndex + 3) {
            filename = parts[thumbIndex + 3];
          } else if (parts.length > 2) {
            filename = parts[parts.length - 2];
          }
        }
        
        // Remove query parameters
        filename = filename.split('?')[0];

        if (filename && filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|svg|webp)/)) {
          console.log(`[Auto-Heal] Failed loading. Extracting raw filename "${filename}". Querying Wikimedia Commons API...`);
          
          let resolvedUrl = '';
          
          // Phase 1: Direct File Title Query
          const directRes = await fetch(
            `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo|categories&cllimit=15&iiprop=url|extmetadata&format=json&origin=*`
          );
          if (directRes.ok) {
            const data = await directRes.json();
            const pages = data.query?.pages;
            if (pages) {
              const pageId = Object.keys(pages)[0];
              const cand = pages[pageId];
              if (pageId && pageId !== "-1" && cand?.imageinfo?.[0]?.url) {
                if (isCertifiedMedicalImage(cand, true, filename)) {
                  resolvedUrl = cand.imageinfo[0].url;
                  console.log(`[Auto-Heal] Phase 1 Success! Found certified file URL: ${resolvedUrl}`);
                }
              }
            }
          }
          
          // Phase 2: If Direct Call fails (e.g. 404 or missing filename), execute smart search term queries
          if (!resolvedUrl) {
            // Term A: Filename stripped of extension, digits at end, and underscores/hyphens turned into spaces
            const termFilename = filename
              .replace(/\.[a-zA-Z0-9]+$/, '') // remove extension
              .replace(/[-_]/g, ' ')          // dashes/underscores to spaces
              .replace(/\s+\d+$/, '')        // remove trailing numbers (like Urethral_caruncle_1 -> Urethral caruncle)
              .trim();
            
            // Term B: The Portuguese/English caption (cleanAlt)
            let baseSearchTerms: string[] = [termFilename];
            if (cleanAlt && cleanAlt !== "Imagem Médica" && cleanAlt.length > 3) {
              if (!baseSearchTerms.includes(cleanAlt)) {
                baseSearchTerms.push(cleanAlt);
              }
              // Translate Portuguese description to highly-matched English query for Wikimedia
              const translatedAlt = getEnglishMedicalTerm(cleanAlt);
              if (translatedAlt && translatedAlt.length > 3 && !baseSearchTerms.includes(translatedAlt)) {
                baseSearchTerms.push(translatedAlt);
              }
            }
            
            // Translate the filename term to English too if relevant
            if (termFilename && termFilename.length > 4) {
              const translatedFilename = getEnglishMedicalTerm(termFilename);
              if (translatedFilename && translatedFilename.length > 3 && !baseSearchTerms.includes(translatedFilename)) {
                baseSearchTerms.push(translatedFilename);
              }
            }
            
            // Apply progressive semantic expansion and term relaxation (stopword removal, keyword isolated fallback phrases)
            const searchTerms = expandSearchTerms(baseSearchTerms);
            
            console.log(`[Auto-Heal] Direct File query returned empty or missing. Checking expanded fallbacks:`, searchTerms);
            
            for (const queryTerm of searchTerms) {
              if (!queryTerm || queryTerm.length < 3) continue;
              try {
                // Increase gsrlimit to 5 to evaluate several media matches and filter out non-image files like PDFs. Include categories and extmetadata.
                const searchRes = await fetch(
                  `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(queryTerm)}&gsrnamespace=6&prop=imageinfo|categories&cllimit=15&iiprop=url|extmetadata&gsrlimit=5&format=json&origin=*`
                );
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  const pages = searchData.query?.pages;
                  if (pages) {
                    const candidates = Object.values(pages) as any[];
                    const bestCandidateUrl = getBestMedicalImageCandidate(candidates, queryTerm);
                    if (bestCandidateUrl) {
                      resolvedUrl = bestCandidateUrl;
                      console.log(`[Auto-Heal] Phase 2 Success! matched certified/highest scored term "${queryTerm}" -> URL ${resolvedUrl}`);
                      break;
                    } else {
                      console.log(`[Auto-Heal] No certified medical image found for "${queryTerm}". Strictly omitting non-certified fallbacks.`);
                    }
                  }
                }
              } catch (searchErr) {
                console.warn(`[Auto-Heal] Search fallback failed for "${queryTerm}":`, searchErr);
              }
            }
          }
          
          if (resolvedUrl) {
            setHealed(true);
            setIsAttemptingHeal(false);
            setHasError(false);
            setIsLoading(false);
            setCurrentSrc(getProxiedUrl(resolvedUrl));
            return;
          }
        }
      } catch (err) {
        console.warn('[Auto-Heal] Wikimedia API call failed:', err);
      }
    }

    // Fallback to error state if healing was unsuccessful or not applicable
    setIsAttemptingHeal(false);
    setHasError(true);
    setIsLoading(false);
  };

  if (!src) return null;

  // Completely delete photo AND its container box from summary layout when deleted is true
  if (overrideState?.deleted) {
    return null;
  }

  if (overrideState?.hidden) {
    return (
      <span className="block my-2 text-center py-2 px-4 bg-stone-50 border border-dashed border-stone-200 rounded-xl max-w-md mx-auto">
        <span className="text-[10px] text-stone-500 font-sans italic flex items-center justify-center gap-2">
          <span>🖼️ Imagem oculta pelo aluno ("{cleanAlt}")</span>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(storageKey);
              window.dispatchEvent(new Event('image-override-updated'));
            }}
            className="text-[#D44E3D] hover:underline font-bold font-sans uppercase text-[9px] tracking-wider cursor-pointer"
          >
            Restaurar
          </button>
        </span>
      </span>
    );
  }

  // Pre-configured medical search URLs
  const searchGoogleImages = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cleanAlt + " medicine pathology")}`;
  const searchPubMed = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(cleanAlt)}`;

  const renderManualInputForm = () => (
    <div className="mt-3 p-3.5 bg-white border border-stone-200 rounded-xl space-y-3 text-left max-w-md mx-auto shadow-sm">
      <span className="text-[10.5px] font-bold text-stone-800 block uppercase tracking-wide flex items-center justify-between">
        <span>Substituir por Imagem Personalizada</span>
        <span className="text-[9px] text-stone-400 font-mono">JPG, PNG, WEBP, SVG</span>
      </span>

      <div className="space-y-2.5">
        <input
          type="text"
          placeholder="Cole a URL da imagem (HTTP/HTTPS ou Data URL)..."
          value={manualUrl}
          onChange={(e) => {
            const val = e.target.value;
            setManualUrl(val);
            setManualPreviewUrl(val.trim());
            setManualPreviewStatus(val.trim() ? 'loading' : 'idle');
          }}
          className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D44E3D] bg-stone-50 font-mono"
        />

        {/* Live Image Preview */}
        {manualPreviewUrl && (
          <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5 text-center">
            <span className="text-[9.5px] font-bold text-stone-500 uppercase tracking-wider block">
              Pré-visualização da Imagem
            </span>
            <div className="relative inline-block max-w-full">
              <img
                src={getProxiedUrl(manualPreviewUrl)}
                alt="Pré-visualização"
                onLoad={() => setManualPreviewStatus('success')}
                onError={() => setManualPreviewStatus('error')}
                className="max-h-36 max-w-full object-contain rounded-lg border border-stone-200 mx-auto shadow-xs"
              />
            </div>
            {manualPreviewStatus === 'success' && (
              <span className="block text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                ✓ Imagem carregada e pronta para salvar!
              </span>
            )}
            {manualPreviewStatus === 'error' && (
              <span className="block text-[10px] font-semibold text-amber-600 flex items-center justify-center gap-1">
                ⚠️ Não foi possível pré-visualizar esta URL. Verifique o link ou envie o arquivo diretamente.
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
          <label className="border border-dashed border-stone-300 hover:border-[#D44E3D] bg-stone-50 hover:bg-stone-100/80 rounded-lg py-1.5 px-3 text-center cursor-pointer transition-all flex items-center gap-1.5 shrink-0">
            <Upload className="w-3.5 h-3.5 text-stone-600" />
            <span className="text-[10px] font-bold text-stone-700">Enviar Foto do Dispositivo</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setIsUploading(true);
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const base64Url = event.target?.result as string;
                    if (base64Url) {
                      setManualUrl(base64Url);
                      setManualPreviewUrl(base64Url);
                      setManualPreviewStatus('success');
                    }
                    setIsUploading(false);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowManualInput(false);
                setManualUrl('');
                setManualPreviewUrl('');
                setManualPreviewStatus('idle');
              }}
              className="px-3 py-1.5 text-[10.5px] font-bold text-stone-600 hover:bg-stone-100 rounded-lg transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                const finalUrl = manualPreviewUrl || manualUrl.trim();
                if (finalUrl) {
                  localStorage.setItem(storageKey, JSON.stringify({ url: finalUrl, hidden: false, deleted: false }));
                  window.dispatchEvent(new Event('image-override-updated'));
                  setShowManualInput(false);
                  setManualUrl('');
                  setManualPreviewUrl('');
                  setManualPreviewStatus('idle');
                } else {
                  alert('Por favor, insira uma URL de imagem válida ou envie um arquivo.');
                }
              }}
              disabled={isUploading}
              className="px-3.5 py-1.5 text-[10.5px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              Salvar Imagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (hasError) {
    return (
      <span className="block my-4">
        <StaticMedicalFigure 
          description={cleanAlt}
          originalAlt={alt || "Ilustração de Livro Médico"}
          onTryAnother={handleCycleImage}
          isSearchingAlternatives={isSearchingAlternatives}
          onSubstituir={() => setShowManualInput(!showManualInput)}
          onExcluirCaixa={() => {
            localStorage.setItem(storageKey, JSON.stringify({ hidden: true, deleted: true }));
            window.dispatchEvent(new Event('image-override-updated'));
          }}
          onOcultar={() => {
            localStorage.setItem(storageKey, JSON.stringify({ hidden: true }));
            window.dispatchEvent(new Event('image-override-updated'));
          }}
        />
        {showManualInput && renderManualInputForm()}
      </span>
    );
  }

  return (
    <span className="block my-6 max-w-full text-center">
      <span className="inline-block max-w-full bg-[#FCFCFB] border border-[#E9E8E4] rounded-2xl overflow-hidden p-2 shadow-sm transition-all duration-300 hover:shadow-md">
        {isLoading && (
          <span className="flex flex-col items-center justify-center p-8 bg-[#F8F9FA] border border-dashed border-gray-200 rounded-xl animate-pulse min-w-[280px]">
            <ImageIcon className="w-5 h-5 text-indigo-500 animate-bounce mb-2" />
            <span className="text-[11px] text-gray-500 font-sans font-semibold">
              {isAttemptingHeal ? "Sincronizando fonte científica..." : "Carregando imagem médica..."}
            </span>
          </span>
        )}

        <img
          src={currentSrc || null}
          alt={alt || "Imagem Médica Ilustrativa"}
          onLoad={() => setIsLoading(false)}
          onError={handleImageError}
          referrerPolicy="no-referrer"
          className={`max-h-[380px] object-contain rounded-xl mx-auto select-none max-w-full transition-opacity duration-300 ${isLoading ? 'opacity-0 h-0 hidden' : 'opacity-100 block cursor-zoom-in'}`}
          onClick={() => window.open(currentSrc, '_blank')}
          {...props}
        />
        
        {alt && !isLoading && !hasError && (
          <span className="block mt-2 px-3 py-1 bg-gray-50 rounded text-[11px] font-medium font-sans text-gray-500 text-center max-w-full select-all">
            📸 <span className="italic">{cleanAlt}</span>
            {sourceText && (
              <span className="ml-1 text-[10px] text-emerald-600 font-semibold uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                Fonte: {sourceText}
              </span>
            )}
            {overrideState?.url && (
              <span className="ml-1 text-[10px] text-amber-600 font-semibold uppercase tracking-wider bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                Personalizada
              </span>
            )}
          </span>
        )}

        {!isLoading && !hasError && (metadata || isMetadataLoading) && (
          <div className="mt-2 px-3 py-2 bg-stone-50/80 rounded-xl border border-stone-200/60 text-left text-[10px] font-sans text-stone-600 space-y-1 max-w-full leading-relaxed select-all">
            {isMetadataLoading ? (
              <div className="flex items-center gap-1.5 text-stone-400 animate-pulse py-0.5 justify-center">
                <span className="w-2 h-2 rounded-full bg-stone-300 animate-ping"></span>
                <span>Buscando referências bibliográficas do Commons...</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                    📖 Referência Científica:
                  </span>
                  <span className="font-medium text-stone-800">
                    {metadata?.source || "Wikimedia Commons (Atlas/Case Report)"}
                  </span>
                </div>
                {metadata?.artist && (
                  <div>
                    <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                      Autor/Contribuição:
                    </span>{" "}
                    <span className="text-stone-700">{metadata.artist}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-200/40 text-[9px]">
                  {metadata?.license && (
                    <div className="flex items-center gap-1 text-stone-500">
                      <span>Licença:</span>
                      {metadata.licenseUrl ? (
                        <a
                          href={metadata.licenseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                        >
                          {metadata.license}
                          <ExternalLink className="w-2 h-2 inline" />
                        </a>
                      ) : (
                        <span className="font-bold text-stone-600">{metadata.license}</span>
                      )}
                    </div>
                  )}
                  <div className="text-stone-400 text-[8px] italic">
                    Livre de problemas autorais • Uso acadêmico certificado
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!isLoading && !hasError && (
          <span className="flex flex-wrap justify-center gap-2 mt-2 px-1">
            <button
              type="button"
              onClick={handleCycleImage}
              disabled={isSearchingAlternatives}
              className="flex items-center gap-1.5 px-3 py-1 font-sans font-bold text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full transition-all active:scale-95 cursor-pointer disabled:opacity-60"
              title="Tentar buscar outra imagem se esta não condizer com o tema"
            >
              <RotateCw className={`w-3 h-3 ${isSearchingAlternatives ? 'animate-spin' : ''}`} />
              {isSearchingAlternatives 
                ? 'Buscando opções...' 
                : hasSearchedAlternatives && alternativeUrls.length > 1
                  ? `Ver outra opção (${altIndex + 1}/${alternativeUrls.length})`
                  : hasSearchedAlternatives && alternativeUrls.length <= 1
                    ? 'Nenhuma outra imagem encontrada'
                    : 'Tentar outra imagem'}
            </button>
            
            <button
              type="button"
              onClick={() => window.open(searchGoogleImages, '_blank')}
              className="flex items-center gap-1 px-2.5 py-1 font-sans font-semibold text-[10px] text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full transition-all active:scale-95 cursor-pointer"
            >
              <Search className="w-3 h-3" />
              Pesquisar Fotos Reais
            </button>

            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="flex items-center gap-1.5 px-3 py-1 font-sans font-bold text-[10px] text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition-all active:scale-95 cursor-pointer"
            >
              <Link className="w-3 h-3" />
              Substituir
            </button>

            {overrideState?.url && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(storageKey);
                  window.dispatchEvent(new Event('image-override-updated'));
                }}
                className="flex items-center gap-1.5 px-3 py-1 font-sans font-bold text-[10px] text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-full transition-all active:scale-95 cursor-pointer"
              >
                Restaurar original
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                localStorage.setItem(storageKey, JSON.stringify({ hidden: true, deleted: true }));
                window.dispatchEvent(new Event('image-override-updated'));
              }}
              className="flex items-center gap-1.5 px-3 py-1 font-sans font-bold text-[10px] text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full transition-all active:scale-95 cursor-pointer"
              title="Excluir esta foto e remover a caixa completamente do resumo"
            >
              <Trash2 className="w-3 h-3 text-red-600" />
              Excluir Foto e Caixa
            </button>

            <button
              type="button"
              onClick={() => {
                localStorage.setItem(storageKey, JSON.stringify({ hidden: true }));
                window.dispatchEvent(new Event('image-override-updated'));
              }}
              className="flex items-center gap-1.5 px-3 py-1 font-sans font-bold text-[10px] text-stone-600 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-full transition-all active:scale-95 cursor-pointer"
            >
              Ocultar
            </button>
          </span>
        )}

        {showManualInput && !isLoading && !hasError && renderManualInputForm()}
      </span>
    </span>
  );
};

function hastToHtml(node: any): string {
  if (!node) return '';
  if (node.type === 'text') {
    return node.value || '';
  }
  if (node.type === 'element') {
    const tagName = node.tagName;
    const attrs = Object.entries(node.properties || {})
      .map(([key, val]) => {
        if (val === true) return key;
        if (val === false || val === null || val === undefined) return '';
        
        if (key === 'style' && typeof val === 'object' && val !== null) {
          const styleStr = Object.entries(val)
            .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
            .join('; ');
          return `style="${styleStr}"`;
        }

        let attrName = key;
        if (key === 'className') {
          if (Array.isArray(val)) {
            return `class="${val.join(' ')}"`;
          }
          return `class="${String(val)}"`;
        }
        
        // Convert common React attribute camelCases back to standard SVG kebab-case
        if (key === 'textAnchor') attrName = 'text-anchor';
        else if (key === 'fontFamily') attrName = 'font-family';
        else if (key === 'fontSize') attrName = 'font-size';
        else if (key === 'fontWeight') attrName = 'font-weight';
        else if (key === 'strokeWidth') attrName = 'stroke-width';
        else if (key === 'strokeDasharray') attrName = 'stroke-dasharray';
        else if (key === 'fillOpacity') attrName = 'fill-opacity';
        else if (key === 'strokeOpacity') attrName = 'stroke-opacity';
        else if (key === 'markerWidth') attrName = 'markerwidth';
        else if (key === 'markerHeight') attrName = 'markerheight';
        else if (key === 'refX') attrName = 'refx';
        else if (key === 'refY') attrName = 'refy';
        else {
          attrName = attrName.replace(/([A-Z])/g, '-$1').toLowerCase();
        }
        
        return `${attrName}="${String(val).replace(/"/g, '&quot;')}"`;
      })
      .filter(Boolean)
      .join(' ');
      
    const childrenHtml = (node.children || []).map(hastToHtml).join('');
    return attrs ? `<${tagName} ${attrs}>${childrenHtml}</${tagName}>` : `<${tagName}>${childrenHtml}</${tagName}>`;
  }
  return '';
}

export function cleanAndFixMarkdownTables(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // 1. Decode double-escaped or stray HTML entities for angle brackets
  cleaned = cleaned
    .replace(/&amp;gt;/gi, '>')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;lt;/gi, '<')
    .replace(/&lt;/gi, '<');

  // 2. Un-concat single-line or corrupted table blocks containing pipes '|'
  if (cleaned.includes('|') && (cleaned.includes('| > |') || cleaned.includes('| |') || cleaned.includes('| ---') || cleaned.includes('| :---'))) {
    cleaned = cleaned
      .replace(/\|\s*>\s*\|/g, '|\n|')
      .replace(/\|\s*>\s*/g, '|\n')
      .replace(/\|\s*\|\s*/g, '|\n|');

    cleaned = cleaned.replace(/([^\n|])\s*(\|(?:(?:\s*:?-+:?\s*)\|)+)/g, '$1\n$2');
  }

  // 3. Extract tables that were placed inside blockquotes (lines starting with '>')
  const lines = cleaned.split('\n');
  const resultLines: string[] = [];
  let insideBlockquoteTable = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    if (/^>\s*\|/.test(trimmed)) {
      line = line.replace(/^>\s*/, '');
      if (!insideBlockquoteTable) {
        resultLines.push('');
        insideBlockquoteTable = true;
      }
    } else if (insideBlockquoteTable && !trimmed.startsWith('|')) {
      insideBlockquoteTable = false;
      resultLines.push('');
    }

    if (line.includes('|')) {
      line = line.replace(/\|\s*>\s*\|/g, '|');
    }

    resultLines.push(line);
  }

  return resultLines.join('\n');
}

export function parseMarkdownAlerts(text: string): string {
  if (!text) return text;
  
  let processed = cleanAndFixMarkdownTables(text);
  
  // 1. Unescape AI-escaped markdown links e.g. \[text\](#anchor) or \[text\]\(#anchor\)
  processed = processed
    .replace(/\\\[([^\]\n]+)\\\]\\?\(([^)\n]+)\\?\)/g, '[$1]($2)')
    .replace(/\[([^\]\n]+)\]\\\(([^)\n]+)\\\)/g, '[$1]($2)')
    .replace(/\\\[([^\]\n]+)\\\]/g, '[$1]');

  // 2. Decode stray HTML entities (e.g., &gt;, &gt, &amp;gt;, &lt;)
  processed = processed
    .replace(/&amp;gt;/gi, '>')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;lt;/gi, '<')
    .replace(/&lt;/gi, '<')
    .replace(/&amp;quot;/gi, '"')
    .replace(/&quot;/gi, '"')
    .replace(/&gt\b/gi, '>')
    .replace(/&lt\b/gi, '<');

  // Replace GFM blockquote alerts (e.g. "> [!NOTE]") with elegant colored headings
  processed = processed.replace(/^>\s*\[!NOTE\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-blue-600 font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">📝 NOTA</span> ${spaces ? spaces : ''}`;
  });
  
  processed = processed.replace(/^>\s*\[!TIP\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-emerald-600 font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">💡 DICA / MACETE</span> ${spaces ? spaces : ''}`;
  });

  processed = processed.replace(/^>\s*\[!IMPORTANT\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-amber-600 font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">✨ IMPORTANTE</span> ${spaces ? spaces : ''}`;
  });

  processed = processed.replace(/^>\s*\[!CAUTION\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-rose-600 font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">⚠️ ATENÇÃO / CUIDADO</span> ${spaces ? spaces : ''}`;
  });

  processed = processed.replace(/^>\s*\[!WARNING\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-rose-600 font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">⚠️ ATENÇÃO / CUIDADO</span> ${spaces ? spaces : ''}`;
  });

  processed = processed.replace(/^>\s*\[!CLINICAL_CASE\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-purple-700 font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">🩺 CASO CLÍNICO PRÁTICO</span> ${spaces ? spaces : ''}`;
  });

  processed = processed.replace(/^>\s*\[!CHECKLIST\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-indigo-700 font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">📋 CONDUTA DE BEIRA DE LEITO</span> ${spaces ? spaces : ''}`;
  });

  processed = processed.replace(/^>\s*\[!SUMMARY\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-[#D44E3D] font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">📌 QUADRO DE DESTAQUE</span> ${spaces ? spaces : ''}`;
  });

  processed = processed.replace(/^>\s*\[!FLOWCHART\]\s*(?:>\s*)?(?:\r?\n|(\s+))?/gim, (match, spaces) => {
    return `> <span class="text-teal-700 font-extrabold font-sans text-xs uppercase tracking-wider block mb-1 select-none">🔄 ALGORITMO & FLUXOGRAMA</span> ${spaces ? spaces : ''}`;
  });
  
  return processed;
}

export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

export const syncSummaryTableOfContents = (content: string): string => {
  if (!content || !content.trim()) return content;

  const lines = content.split('\n');
  const headings: { title: string; slug: string; level: number }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      const headingText = trimmed.replace(/^##\s+/, '').trim();
      const lower = headingText.toLowerCase();
      if (
        !lower.includes('sumário') &&
        !lower.includes('sumario') &&
        !lower.includes('índice') &&
        !lower.includes('indice')
      ) {
        if (headingText) {
          const cleanTitle = headingText.replace(/[*_~`]/g, '').trim();
          headings.push({
            title: cleanTitle,
            slug: slugify(cleanTitle),
            level: 2
          });
        }
      }
    } else if (
      trimmed.startsWith('### 🧬 Aprofundamento') ||
      trimmed.startsWith('### Aprofundamento') ||
      trimmed.startsWith('### 💬 Preceptor') ||
      trimmed.startsWith('### 💬 Dúvida') ||
      trimmed.startsWith('### 💬 Esclarecimento')
    ) {
      const headingText = trimmed.replace(/^###\s+/, '').trim();
      if (headingText) {
        const cleanTitle = headingText.replace(/[*_~`]/g, '').trim();
        headings.push({
          title: cleanTitle,
          slug: slugify(cleanTitle),
          level: 3
        });
      }
    }
  }

  if (headings.length === 0) return content;

  // Build the unified SUMÁRIO DE NAVEGAÇÃO markdown block
  let sumarioBlock = `## SUMÁRIO DE NAVEGAÇÃO\n\n`;
  headings.forEach((h) => {
    const prefix = h.level === 3 ? `  - ` : `- `;
    sumarioBlock += `${prefix}[${h.title}](#${h.slug})\n`;
  });
  sumarioBlock += `\n---\n`;

  // Find existing SUMÁRIO DE NAVEGAÇÃO header
  const sumarioHeaderRegex = /(?:^|\n)#+\s*(SUMÁRIO\s*DE\s*NAVEGAÇÃO|SUMÁRIO|SUMARIO|ÍNDICE|INDICE)/i;
  const match = content.match(sumarioHeaderRegex);

  if (match && match.index !== undefined) {
    const startIndex = match.index === 0 ? 0 : match.index + 1;
    const searchFrom = startIndex + match[0].length;
    
    // Look for the next ## heading that is not a sumário heading
    const rest = content.substring(searchFrom);
    const chapterHeadingMatch = rest.match(/\n##\s+(?!(SUMÁRIO|SUMARIO|ÍNDICE|INDICE))/i);

    if (chapterHeadingMatch && chapterHeadingMatch.index !== undefined) {
      const endIndex = searchFrom + chapterHeadingMatch.index;
      const topPart = content.substring(0, startIndex).trimEnd();
      const bottomPart = content.substring(endIndex).trimStart();
      return `${topPart}\n\n${sumarioBlock}\n\n${bottomPart}`;
    }
  }

  // If no existing sumário block was found or no subsequent chapter heading matched, insert after main title
  const firstHrIndex = content.indexOf('\n---\n');
  if (firstHrIndex !== -1) {
    const top = content.substring(0, firstHrIndex + 5);
    const rest = content.substring(firstHrIndex + 5);
    return `${top}\n\n${sumarioBlock}\n\n${rest.trim()}`;
  } else {
    const firstH1Index = content.indexOf('\n# ');
    if (firstH1Index !== -1) {
      const nextLine = content.indexOf('\n', firstH1Index + 1);
      const top = content.substring(0, nextLine);
      const rest = content.substring(nextLine);
      return `${top}\n\n---\n\n${sumarioBlock}\n\n${rest.trim()}`;
    } else {
      return `${sumarioBlock}\n\n${content}`;
    }
  }
};

const getParagraphText = (node: any): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getParagraphText).join('');
  if (node.props && node.props.children) return getParagraphText(node.props.children);
  return '';
};

const getHeaderStyle = (text: string) => {
  const t = text.toLowerCase().trim();

  // Clinical Case / Vinheta
  if (t.includes('caso clínico') || t.includes('caso clinico') || t.includes('vinheta') || t.includes('exemplo prático') || t.includes('exemplo pratico') || t.includes('caso 1') || t.includes('caso 2') || t.includes('caso 3')) {
    return {
      type: 'case',
      badge: 'Caso Clínico Prático',
      badgeBg: 'bg-amber-100/90 text-amber-900 border-amber-300/80',
      border: 'border-l-4 border-amber-500',
      bg: 'bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent',
      text: 'text-amber-950',
      icon: Activity,
      iconColor: 'text-amber-600'
    };
  }

  // Treatment / Conduta / Manejo
  if (t.includes('tratamento') || t.includes('conduta') || t.includes('manejo') || t.includes('farmacologia') || t.includes('terapêutica') || t.includes('terapeutica') || t.includes('prescrição') || t.includes('prescricao')) {
    return {
      type: 'treatment',
      badge: 'Conduta & Terapêutica',
      badgeBg: 'bg-emerald-100/90 text-emerald-900 border-emerald-300/80',
      border: 'border-l-4 border-emerald-600',
      bg: 'bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent',
      text: 'text-emerald-950',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600'
    };
  }

  // Diagnosis & Tests
  if (t.includes('diagnóstico') || t.includes('diagnostico') || t.includes('exames') || t.includes('investigação') || t.includes('investigacao') || t.includes('critérios') || t.includes('criterios') || t.includes('laboratório') || t.includes('laboratorio')) {
    return {
      type: 'diagnosis',
      badge: 'Diagnóstico & Exames',
      badgeBg: 'bg-teal-100/90 text-teal-900 border-teal-300/80',
      border: 'border-l-4 border-teal-600',
      bg: 'bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent',
      text: 'text-teal-950',
      icon: Stethoscope,
      iconColor: 'text-teal-600'
    };
  }

  // Clinical Presentation / Sinais e Sintomas
  if (t.includes('quadro clínico') || t.includes('quadro clinico') || t.includes('sinais') || t.includes('sintomas') || t.includes('manifestações') || t.includes('manifestacoes') || t.includes('exame físico') || t.includes('exame fisico')) {
    return {
      type: 'presentation',
      badge: 'Sinais & Sintomas',
      badgeBg: 'bg-orange-100/90 text-orange-900 border-orange-300/80',
      border: 'border-l-4 border-orange-500',
      bg: 'bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent',
      text: 'text-orange-950',
      icon: Zap,
      iconColor: 'text-orange-600'
    };
  }

  // Pathophysiology & Etiology
  if (t.includes('fisiopatologia') || t.includes('etiologia') || t.includes('causas') || t.includes('mecanismo') || t.includes('patogênese') || t.includes('patogenese')) {
    return {
      type: 'patho',
      badge: 'Fisiopatologia & Mecanismo',
      badgeBg: 'bg-indigo-100/90 text-indigo-900 border-indigo-300/80',
      border: 'border-l-4 border-indigo-600',
      bg: 'bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent',
      text: 'text-indigo-950',
      icon: Brain,
      iconColor: 'text-indigo-600'
    };
  }

  // Red Flags / Alerts / Emergencies / Complications
  if (t.includes('alerta') || t.includes('red flags') || t.includes('emergência') || t.includes('emergencia') || t.includes('complicações') || t.includes('complicacoes') || t.includes('gravidade')) {
    return {
      type: 'alert',
      badge: 'Atenção & Red Flags',
      badgeBg: 'bg-rose-100/90 text-rose-900 border-rose-300/80',
      border: 'border-l-4 border-rose-600',
      bg: 'bg-gradient-to-r from-rose-500/10 via-red-500/5 to-transparent',
      text: 'text-rose-950',
      icon: ShieldAlert,
      iconColor: 'text-rose-600'
    };
  }

  // High Yield / Summary / Takeaways / Pérolas
  if (t.includes('pérola') || t.includes('perola') || t.includes('macete') || t.includes('resumo') || t.includes('ponto chave') || t.includes('pontos chave') || t.includes('revisão') || t.includes('revisao')) {
    return {
      type: 'yield',
      badge: 'Ponto-Chave de Prova',
      badgeBg: 'bg-amber-100/90 text-amber-900 border-amber-300/80',
      border: 'border-l-4 border-amber-500',
      bg: 'bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent',
      text: 'text-amber-950',
      icon: Sparkles,
      iconColor: 'text-amber-600'
    };
  }

  return null;
};


export interface GraphNode {
  id: string;
  label: string;
  shape: string;
  fillcolor?: string;
  color?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export const parseDOT = (dotText: string) => {
  const nodes: Record<string, GraphNode> = {};
  const edges: GraphEdge[] = [];
  
  // Clean comments and normalize newlines
  const lines = dotText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//') && !line.startsWith('#') && !line.startsWith('/*'));
    
  // Helper to strip quotes and semicolons around identifiers
  const cleanId = (id: string) => id.trim().replace(/^"|"$/g, '').trim();

  for (let line of lines) {
    if (line.startsWith('digraph') || line.startsWith('}') || line.startsWith('{')) continue;
    if (line.startsWith('rankdir') || line.startsWith('node') || line.startsWith('edge') || line.startsWith('graph')) continue;
    
    // An identifier can be a word with hyphens or quotes: (?:[a-zA-Z0-9_\-]+|"[^"]+")
    const idPattern = '(?:[a-zA-Z0-9_\\-]+|"[^"]+")';
    
    // Check if edge definition: e.g. A -> B [label="SIM"];
    const edgeRegex = new RegExp(`^(${idPattern})\\s*->\\s*(${idPattern})(?:\\s*\\[([^\\]]+)\\])?`);
    const edgeMatch = line.match(edgeRegex);
    if (edgeMatch) {
      const from = cleanId(edgeMatch[1]);
      const to = cleanId(edgeMatch[2]);
      const attrsStr = edgeMatch[3] || '';
      let label = '';
      
      const labelMatch = attrsStr.match(/label\s*=\s*"([^"]+)"/);
      if (labelMatch) {
        label = labelMatch[1].replace(/\\n/g, '\n');
      }
      edges.push({ from, to, label });
      continue;
    }
    
    // Check if node definition: e.g. A [label="Paciente com Taquiarritmia", fillcolor="#E2E8F0"];
    const nodeRegex = new RegExp(`^(${idPattern})\\s*\\[([^\\]]+)\\]`);
    const nodeMatch = line.match(nodeRegex);
    if (nodeMatch) {
      const id = cleanId(nodeMatch[1]);
      const attrsStr = nodeMatch[2];
      let label = id;
      let shape = 'box';
      let fillcolor = '';
      let color = '';
      
      const labelMatch = attrsStr.match(/label\s*=\s*"([^"]+)"/);
      if (labelMatch) {
        label = labelMatch[1].replace(/\\n/g, '\n');
      }
      
      const shapeMatch = attrsStr.match(/shape\s*=\s*(\w+|"[^"]+")/);
      if (shapeMatch) {
        shape = cleanId(shapeMatch[1]);
      }
      
      const fillMatch = attrsStr.match(/fillcolor\s*=\s*"([^"]+)"/);
      if (fillMatch) {
        fillcolor = fillMatch[1];
      }
      
      const colorMatch = attrsStr.match(/color\s*=\s*"([^"]+)"/);
      if (colorMatch) {
        color = colorMatch[1];
      }
      
      nodes[id] = { id, label, shape, fillcolor, color };
    }
  }
  
  // Create nodes that are mentioned in edges but not explicitly defined
  edges.forEach(edge => {
    if (!nodes[edge.from]) {
      nodes[edge.from] = { id: edge.from, label: edge.from, shape: 'box' };
    }
    if (!nodes[edge.to]) {
      nodes[edge.to] = { id: edge.to, label: edge.to, shape: 'box' };
    }
  });
  
  return { nodes, edges };
};

export const ClinicalAlgorithm = ({ dotText }: { dotText: string }) => {
  return <TreeBranchRenderer text={dotText} />;
};


const normalizeTextForMarkdown = (rawText: string): string => {
  if (!rawText) return '';

  // 1. Remove inline garbled Table of Contents lines (e.g. "1. Fisiopatologia... \t 3. Taquiarritmias...")
  let processed = rawText
    .replace(/(?:^|\n)(?:Sumário|Índice|TOC|Conteúdo):\s*\n*(?:\d+\.\s+[^\n]+\n*){2,}/gi, '\n')
    .replace(/(\d+\.\s+[^\n\t\d]{3,50})(?:\t|\s{4,})(?=\d+\.)/g, '$1\n');

  // 1b. Remove duplicate secondary SUMÁRIO DE NAVEGAÇÃO / SUMÁRIO blocks
  const sumarioMatches = [...processed.matchAll(/#+\s*(SUMÁRIO\s*DE\s*NAVEGAÇÃO|SUMÁRIO|SUMARIO|ÍNDICE|INDICE)/gi)];
  if (sumarioMatches.length > 1) {
    const firstMatch = sumarioMatches[0];
    const firstIndex = firstMatch.index ?? 0;
    const afterFirstHeader = firstIndex + firstMatch[0].length;
    const nextHeadingMatch = processed.substring(afterFirstHeader).match(/\n---\n|\n##\s+/);
    let firstBlockEnd = processed.length;
    if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
      firstBlockEnd = afterFirstHeader + nextHeadingMatch.index + nextHeadingMatch[0].length;
    }
    const topPart = processed.substring(0, firstBlockEnd);
    let restPart = processed.substring(firstBlockEnd);
    restPart = restPart.replace(/#+\s*(SUMÁRIO\s*DE\s*NAVEGAÇÃO|SUMÁRIO|SUMARIO|ÍNDICE|INDICE)[\s\S]*?(?=\n#+\s+[A-Za-z0-9]|\n---\n|$)/gi, '');
    processed = topPart + restPart;
  }

  if (!processed.includes('|')) return processed;
  const lines = processed.split('\n');
  const result: string[] = [];
  let tableRows: string[] = [];
  let inCodeBlock = false;

  const isSep = (l: string) => /^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)+\|?$/.test(l.trim());

  const isTableLine = (l: string) => {
    const t = l.trim();
    if (!t || inCodeBlock || t.startsWith('```') || t.startsWith('#')) return false;
    if (/[┴┬┌┐└┘─▲▼░█■┼│├┤┬┴┌┐└┘┼→➔]/.test(t)) return false;
    if (t.includes('Linha de base') || t.includes('Infradesnivelamento') || t.includes('Supradesnivelamento') || t.includes('ECG') || t.includes('R alta') || t.includes('Parede Posterior') || t.includes('Pseudo')) return false;
    const parts = t.split('|').map(p => p.trim()).filter(Boolean);
    return parts.length >= 2 || isSep(t);
  };

  const flush = () => {
    if (tableRows.length === 0) return;
    const hasSep = tableRows.some(isSep);
    
    if (!hasSep) {
      const validTableRows = tableRows.filter(r => {
        const parts = r.split('|').map(c => c.trim()).filter(Boolean);
        return parts.length >= 2 && !parts.some(p => /^[\/\\\^─\s]+$/.test(p));
      });
      if (validTableRows.length < 2) {
        result.push(...tableRows);
        tableRows = [];
        return;
      }
    }

    const normalized = tableRows.map(r => {
      const trimmed = r.trim();
      if (isSep(trimmed)) return trimmed;
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      return `| ${cells.join(' | ')} |`;
    });

    if (!hasSep && normalized.length > 0) {
      const firstCells = tableRows[0].split('|').map(c => c.trim()).filter(Boolean);
      const cols = Math.max(1, firstCells.length);
      const sep = `| ${Array(cols).fill('---').join(' | ')} |`;
      result.push(normalized[0]);
      result.push(sep);
      for (let i = 1; i < normalized.length; i++) {
        result.push(normalized[i]);
      }
    } else {
      result.push(...normalized);
    }
    tableRows = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      flush();
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    if (isTableLine(line)) {
      tableRows.push(line);
    } else {
      flush();
      result.push(line);
    }
  }
  flush();

  return result.join('\n');
};

export const InlineClinicalText = ({ text, className = '' }: { text: string; className?: string }) => {
  if (!text) return null;

  // Clean LaTeX expressions
  const cleaned = text
    .replace(/\$\\ge\s*(\d+)\\text\{\s*(\w+)\}\$/g, '≥ $1 $2')
    .replace(/\$\\ge\s*(\d+)\$/g, '≥ $1')
    .replace(/\$<(\d+)\\\%\$/g, '< $1%')
    .replace(/\\ge/g, '≥')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\$/g, '');

  const examPattern = /(?:\[|\()?PROVA:?\s*|\b(?:BANCA|COBRADO EM)?\s*(ENARE|SES-DF|SES-GO|SUS-GO|USP|USP-SP|UNICAMP|UNIFESP|UFRJ|PSU-MG|SUS-SP|REVALIDA|AMP|UFG|UnB|HBDF|FCMMG|CERMAM|FAMERP|SANTA CASA)\s*[-/]?\s*\(?(201[89]|202[0-6])\)?\]?/gi;

  if (examPattern.test(cleaned)) {
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    const regex = new RegExp(examPattern);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cleaned)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleaned.substring(lastIndex, match.index));
      }
      const banca = match[1];
      const ano = match[2];
      parts.push(
        <span key={`exam-${match.index}`} className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white font-black text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-400/80 shadow-xs mx-1 align-middle whitespace-nowrap">
          <Award className="w-3.5 h-3.5 text-yellow-200 shrink-0" />
          {banca} ({ano})
        </span>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < cleaned.length) {
      parts.push(cleaned.substring(lastIndex));
    }

    return (
      <span className={`inline-block max-w-full min-w-0 break-words whitespace-normal text-left ${className}`}>
        {parts.map((p, idx) => typeof p === 'string' ? (
          <ReactMarkdown 
            key={idx} 
            components={{ 
              p: ({ children }) => <span className="inline break-words whitespace-normal">{children}</span> 
            }}
          >
            {p}
          </ReactMarkdown>
        ) : p)}
      </span>
    );
  }

  return (
    <span className={`inline-block max-w-full min-w-0 break-words whitespace-normal text-left ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <span className="inline break-words whitespace-normal">{children}</span>,
          strong: ({ children }) => (
            <strong className="font-black text-amber-950 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs inline-block max-w-full break-words whitespace-normal">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-indigo-950 font-bold bg-indigo-50 px-1 rounded border border-indigo-200 inline-block max-w-full break-words whitespace-normal">
              {children}
            </em>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 bg-stone-100 text-stone-900 rounded text-xs font-mono font-bold border border-stone-300 inline-block max-w-full break-words whitespace-normal">
              {children}
            </code>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-4 space-y-1 my-1 break-words whitespace-normal text-left w-full min-w-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 space-y-1 my-1 break-words whitespace-normal text-left w-full min-w-0">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="break-words whitespace-normal text-left w-full min-w-0">
              {children}
            </li>
          )
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </span>
  );
};

const renderMonospacedLine = (line: string) => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2);
      return (
        <span key={idx} className="font-extrabold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600/70">
          {inner}
        </span>
      );
    }
    return <span key={idx} className="text-emerald-300">{part}</span>;
  });
};

export function sanitizeClinicalText(str: string): string {
  if (!str) return '';
  return str
    // Remove box-drawing characters
    .replace(/[\u2500-\u257F]/g, ' ')
    // Remove stray pipes, underscores, specific border symbols
    .replace(/[\|│─┌┐└┘┬┴┼┤├═╔═╗╚═╝]/g, ' ')
    // Remove leading/trailing border symbols, arrows, bullet markers
    .replace(/^[\s\-\+\=\•\▲\▼\◄\►\→\➔\↓\↑]+/, '')
    .replace(/[\s\-\+\=\•\▲\▼\◄\►\→\➔\↓\↑]+$/, '')
    // Collapse spaces
    .replace(/\s+/g, ' ')
    .trim();
}

interface ClinicalTreeNode {
  id: string;
  depth: number;
  rawLine: string;
  cleanText: string;
  condition: string;
  subtitle?: string;
  outcome?: string;
  action?: string;
  actionList?: string[];
  branchTag?: string;
  stepIndex?: number;
  sectionTitle?: string;
  children: ClinicalTreeNode[];
}

interface ClinicalTreeParseResult {
  rootTitle: string;
  rootNodes: ClinicalTreeNode[];
  allLines: string[];
}

function parseClinicalTreeStructure(rawText: string): ClinicalTreeParseResult {
  const cleanText = rawText
    .replace(/\$\\ge\s*(\d+)\\text\{\s*(\w+)\}\$/g, '≥ $1 $2')
    .replace(/\$\\ge\s*(\d+)\$/g, '≥ $1')
    .replace(/\$<(\d+)\\\%\$/g, '< $1%')
    .replace(/\\ge/g, '≥')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\$/g, '');

  const lines = cleanText.split('\n');
  const nonBlankLines = lines.filter(l => l.trim().length > 0);
  
  if (nonBlankLines.length === 0) {
    return { rootTitle: 'Algoritmo Decisório Clínico', rootNodes: [], allLines: [] };
  }

  const isPureBorder = (str: string) => /^[\s\t\u2500-\u257F\-\+\|\+\=▲▼◄►\•\s]+$/.test(str.trim());

  const isSectionHeaderChunk = (str: string): boolean => {
    const trimmed = str.trim();
    if (!trimmed) return false;
    if (/^\[?\s*(?:ETAPA|PASSO|FASE|PARTE|SEÇÃO|BLOCO)\b/i.test(trimmed)) return true;
    if (/^(?:FASE|PASSO|ETAPA|PARTE|SEÇÃO)\s*[\d\-A-Za-z\:\.]+/i.test(trimmed)) return true;
    if (/^\#+\s+/.test(trimmed)) return true;
    if (/^\=\=+.+\=\=+$/.test(trimmed) || /^\-\-\-+.+\-\-\-+$/.test(trimmed)) return true;
    return false;
  };

  // 1. Determine Root Title (check first non-border text line)
  let rootTitle = 'Algoritmo Decisório Clínico';
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const raw = lines[i];
    if (!raw || isPureBorder(raw)) continue;
    const clean = raw.replace(/^[\s\t\u2500-\u257F\-\+\|\•\[\]\(\)]+/, '').replace(/[\s\t\u2500-\u257F\-\+\|\•\[\]\(\)]+$/, '').trim();
    if (clean && clean.length > 2) {
      rootTitle = clean;
      break;
    }
  }

  const bracketMatch = cleanText.match(/\[(.*?)\]/);
  if (bracketMatch && bracketMatch[1] && bracketMatch[1].length > 3) {
    rootTitle = bracketMatch[1].trim();
  }

  interface SpatialFragment {
    lineIndex: number;
    startCol: number;
    endCol: number;
    textLines: string[];
    rawLine: string;
    isHeader?: boolean;
  }

  const fragments: SpatialFragment[] = [];

  // 2. Extract spatial text fragments line by line
  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const rawLine = lines[lIdx];
    if (isPureBorder(rawLine)) continue;

    // Split line into non-border text chunks
    const chunkRegex = /([^\u2500-\u257F\-\+\|\+\=▲▼◄►]+)/g;
    let match;
    while ((match = chunkRegex.exec(rawLine)) !== null) {
      const textVal = match[1].trim();
      if (!textVal || textVal.length === 0) continue;
      if (isPureBorder(textVal)) continue;

      const startCol = match.index;
      const endCol = match.index + match[0].length;

      // Clean leading/trailing brackets or symbols
      const cleanedChunk = textVal
        .replace(/^[\s\t\u2500-\u257F\-\+\|\•▲▼◄►\(\)\[\]]+/, '')
        .replace(/[\s\t\u2500-\u257F\-\+\|\•▲▼◄►\(\)\[\]]+$/, '')
        .trim();

      if (!cleanedChunk || cleanedChunk === rootTitle) continue;

      const isHeader = isSectionHeaderChunk(cleanedChunk) || isSectionHeaderChunk(textVal);

      fragments.push({
        lineIndex: lIdx,
        startCol,
        endCol,
        textLines: [cleanedChunk],
        rawLine,
        isHeader
      });
    }
  }

  // 3. Merge vertical multi-line text fragments belonging to the same column box
  const mergedFragments: SpatialFragment[] = [];
  for (const frag of fragments) {
    let merged = false;
    for (let j = mergedFragments.length - 1; j >= 0; j--) {
      const candidate = mergedFragments[j];

      // Never merge headers into regular box content or vice-versa
      if (frag.isHeader || candidate.isHeader) continue;

      const lineGap = frag.lineIndex - candidate.lineIndex;
      const isPrecedingLine = lineGap >= 1 && lineGap <= 3;
      
      const colStartDiff = Math.abs(frag.startCol - candidate.startCol);
      const overlapStart = Math.max(frag.startCol, candidate.startCol);
      const overlapEnd = Math.min(frag.endCol, candidate.endCol);
      const overlapWidth = overlapEnd - overlapStart;

      // Strict column positioning so adjacent columns on line 10+ never merge horizontally
      const isSameColumnPos = colStartDiff <= 6 || overlapWidth >= 2;
      
      if (isPrecedingLine && isSameColumnPos) {
        candidate.textLines.push(...frag.textLines);
        candidate.endCol = Math.max(candidate.endCol, frag.endCol);
        candidate.lineIndex = frag.lineIndex;
        merged = true;
        break;
      }
    }
    
    if (!merged) {
      mergedFragments.push({ ...frag });
    }
  }

  // Filter out standalone headers so they don't turn into blank boxes, but track them
  let currentActiveSection: string | undefined = undefined;
  const validFragments: SpatialFragment[] = [];
  for (const frag of mergedFragments) {
    const textJoined = frag.textLines.join(' ').trim();
    if (frag.isHeader || isSectionHeaderChunk(textJoined)) {
      currentActiveSection = sanitizeClinicalText(textJoined);
    } else {
      validFragments.push({
        ...frag,
        isHeader: false
      });
    }
  }

  // Sort fragments strictly by line index (top-to-bottom), then column position (left-to-right)
  validFragments.sort((a, b) => {
    if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
    return a.startCol - b.startCol;
  });

  // 4. Transform merged spatial fragments into ClinicalTreeNode objects with step numbers
  let stepCounter = 1;
  const nodes: (ClinicalTreeNode & { startCol: number; endCol: number; lineIndex: number })[] = validFragments.map((frag, idx) => {
    const linesArr = frag.textLines;
    const fullCleanText = linesArr.join(' ');

    let branchTag: string | undefined = undefined;
    if (/\b(sim|instáv|emergên|crític|choque)\b/i.test(fullCleanText) || fullCleanText.startsWith('► SIM') || fullCleanText.startsWith('[SIM]')) {
      branchTag = 'SIM (Instabilidade)';
    } else if (/\b(não|nao|estáv|assinto)\b/i.test(fullCleanText) || fullCleanText.startsWith('► NÃO') || fullCleanText.startsWith('[NÃO]')) {
      branchTag = 'NÃO (Estabilidade)';
    } else if (/<\s*48\s*horas/i.test(fullCleanText)) {
      branchTag = '< 48 HORAS';
    } else if (/>\s*48\s*horas|desconhecido/i.test(fullCleanText)) {
      branchTag = '> 48 HORAS / DESCONHECIDO';
    }

    let condition = linesArr[0] || '';
    let subtitle: string | undefined = undefined;
    let actionList: string[] = [];

    if (linesArr.length > 1 && linesArr[1].trim().startsWith('(') && linesArr[1].trim().endsWith(')')) {
      subtitle = linesArr[1].trim();
      actionList = linesArr.slice(2);
    } else if (linesArr.length > 1) {
      actionList = linesArr.slice(1);
    }

    condition = condition
      .replace(/^►\s*(SIM|NÃO|NAO)\b/i, '')
      .replace(/^\[(SIM|NÃO|NAO)\]/i, '')
      .replace(/^(SIM|NÃO|NAO):\s*/i, '')
      .replace(/^►\s*/, '')
      .trim();

    actionList = actionList
      .map(a => a.replace(/^[\-\•\➔\→\>\[\]]+\s*/, '').trim())
      .filter(a => a.length > 0 && !/^[▼↓▲↑→➔|\s\-\=]+$/.test(a));

    let action = actionList.length > 0 ? actionList.join(' • ') : undefined;

    // Use sanitizeClinicalText to clean fields perfectly
    const cleanCondition = sanitizeClinicalText(condition);
    const cleanSubtitle = subtitle ? sanitizeClinicalText(subtitle) : undefined;
    const cleanAction = action ? sanitizeClinicalText(action) : undefined;
    const cleanActionList = actionList.map(a => sanitizeClinicalText(a)).filter(a => a.length > 0);

    const stepIndex = stepCounter++;

    return {
      id: `node-${frag.lineIndex}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      depth: 1,
      rawLine: frag.rawLine,
      cleanText: fullCleanText,
      condition: cleanCondition,
      subtitle: cleanSubtitle,
      action: cleanAction,
      actionList: cleanActionList,
      branchTag,
      stepIndex,
      sectionTitle: currentActiveSection,
      startCol: frag.startCol,
      endCol: frag.endCol,
      lineIndex: frag.lineIndex,
      children: []
    };
  });

  // 5. Connect parent-child links based on vertical line sequence and spatial column overlap
  const rootNodes: ClinicalTreeNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // Look for parent on an earlier line index
    let parentNode: typeof node | null = null;
    let bestScore = Infinity;

    for (let j = i - 1; j >= 0; j--) {
      const candidate = nodes[j];
      if (candidate.lineIndex >= node.lineIndex) continue;

      // Check column alignment / overlap with spatial tolerance
      const overlap = (node.startCol >= candidate.startCol - 15 && node.startCol <= candidate.endCol + 15) ||
                      (node.endCol >= candidate.startCol - 15 && node.endCol <= candidate.endCol + 15) ||
                      (candidate.startCol >= node.startCol - 15 && candidate.startCol <= node.endCol + 15);

      if (overlap) {
        const lineDist = node.lineIndex - candidate.lineIndex;
        const nodeCenter = (node.startCol + node.endCol) / 2;
        const candCenter = (candidate.startCol + candidate.endCol) / 2;
        const horizDist = Math.abs(nodeCenter - candCenter);

        // Prioritize closest preceding line, then closest horizontal center
        const score = lineDist * 1000 + horizDist;

        if (score < bestScore) {
          bestScore = score;
          parentNode = candidate;
        }
      }
    }

    if (parentNode) {
      node.depth = parentNode.depth + 1;
      parentNode.children.push(node);
    } else {
      node.depth = 1;
      rootNodes.push(node);
    }
  }

  return { rootTitle, rootNodes, allLines: lines };
}

// Render tree nodes cleanly without nested visual boxes to prevent mobile horizontal squeeze
const ClinicalTreeNodeRenderer = ({ 
  node, 
  isRootLevel = false,
  stepBadgeText
}: { 
  node: ClinicalTreeNode; 
  isRootLevel?: boolean;
  stepBadgeText?: string;
}) => {
  const isInstavel = /instáv|emergên|crític|choque|desfibril|torsades|grave/i.test(node.cleanText);
  const isEstavel = /estáv|assinto|sucesso|reversão|normal/i.test(node.cleanText);
  const isWarning = /alerta|refratár|segunda linha|atenção|cuidado|> 48/i.test(node.cleanText);

  const themeStyles = isInstavel
    ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs'
    : isEstavel
    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
    : isWarning
    ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
    : isRootLevel
    ? 'bg-gradient-to-br from-indigo-50/90 via-slate-50 to-blue-50/80 border-indigo-300 text-stone-900 shadow-sm'
    : 'bg-white border-stone-300 text-stone-900 shadow-xs';

  const badgeContent = stepBadgeText || `Etapa #${node.depth || 1}`;

  return (
    <div className="w-full min-w-0 space-y-3">
      {/* Optional Section Banner if present */}
      {node.sectionTitle && (
        <div className="flex items-center gap-2 mb-2 text-xs font-black uppercase tracking-wider text-indigo-900 bg-indigo-100/90 px-3.5 py-1.5 rounded-xl border border-indigo-300 shadow-2xs w-max max-w-full truncate">
          <Bookmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">{node.sectionTitle}</span>
        </div>
      )}

      {/* Visual Card - flat container to never nest background colors or double borders */}
      <div className={`rounded-2xl border-2 p-4 sm:p-5 transition-all w-full min-w-0 overflow-hidden shadow-xs ${themeStyles}`}>
        <div className="space-y-3 min-w-0 w-full">
          {/* Condition & Subtitle */}
          <div className="flex items-start gap-2.5 min-w-0 w-full">
            {isInstavel && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            {isEstavel && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            {!isInstavel && !isEstavel && <Zap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />}
            
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="bg-stone-900 text-white border border-stone-700 text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md shadow-2xs">
                  {badgeContent}
                </span>
                {node.branchTag && (
                  <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md shadow-2xs ${
                    node.branchTag.includes('SIM') || node.branchTag.includes('> 48')
                      ? 'bg-amber-900 text-amber-100 border border-amber-700'
                      : 'bg-emerald-900 text-emerald-100 border border-emerald-700'
                  }`}>
                    {node.branchTag}
                  </span>
                )}
              </div>

              <h4 className="text-xs sm:text-sm font-black leading-snug text-stone-950 break-words">
                <InlineClinicalText text={node.condition} />
              </h4>

              {node.subtitle && (
                <p className="text-[11px] font-bold text-stone-600 leading-normal break-words pt-0.5">
                  <InlineClinicalText text={node.subtitle} />
                </p>
              )}

              {node.outcome && (
                <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 bg-stone-100 text-stone-950 px-3 py-1 rounded-xl border border-stone-300 font-extrabold text-xs max-w-full break-words">
                  <span className="text-stone-400 font-bold shrink-0">➔</span>
                  <InlineClinicalText text={node.outcome} />
                </div>
              )}
            </div>
          </div>

          {/* Action List / Prescriptions Block */}
          {((node.actionList && node.actionList.length > 0) || node.action) && (
            <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white p-3.5 rounded-xl border border-teal-700 shadow-xs space-y-1.5 w-full min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-teal-200">
                <Zap className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                <span>Conduta Terapêutica & Prescrição:</span>
              </div>

              {node.actionList && node.actionList.length > 0 ? (
                <div className="space-y-1 mt-1">
                  {node.actionList.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs font-extrabold text-white leading-relaxed break-words">
                      <span className="text-teal-400 font-mono font-bold shrink-0">•</span>
                      <span className="flex-1 min-w-0"><InlineClinicalText text={item} /></span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white text-xs sm:text-sm font-extrabold leading-normal break-words">
                  <InlineClinicalText text={node.action || ''} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Children Sub-Nodes - rendered OUTSIDE the card box in a full-width responsive layout */}
      {node.children && node.children.length > 0 && (
        <div className="mt-2 space-y-3 w-full min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-stone-500 pt-1 px-1">
            <ChevronDown className="w-3.5 h-3.5 text-indigo-500 shrink-0 animate-bounce" />
            <span>Desdobramentos Decisórios Clínicos:</span>
          </div>

          <div className={node.children.length > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-3 w-full min-w-0" : "space-y-3 w-full min-w-0"}>
            {node.children.map((childNode, cIdx) => (
              <div key={childNode.id} className="w-full min-w-0">
                <ClinicalTreeNodeRenderer node={childNode} isRootLevel={false} stepBadgeText={`Ramo #${cIdx + 1}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ClinicalTextProseRenderer = ({ text }: { text: string }) => {
  const sections = useMemo(() => {
    if (!text) return [];

    // 1. Graphviz DOT Parsing
    if (text.includes('digraph') || text.includes('graph {')) {
      const nodesMap = new Map<string, string>();
      const edges: { from: string; to: string; label?: string }[] = [];

      const nodeRegex = /(\w+)\s*\[[^\]]*label\s*=\s*"([^"]+)"/g;
      let match;
      while ((match = nodeRegex.exec(text)) !== null) {
        nodesMap.set(match[1], match[2].replace(/\\n/g, ' '));
      }

      const edgeRegex = /(\w+)\s*->\s*(\w+)(?:\s*\[[^\]]*label\s*=\s*"([^"]+)"\])?/g;
      while ((match = edgeRegex.exec(text)) !== null) {
        edges.push({
          from: match[1],
          to: match[2],
          label: match[3]
        });
      }

      const items: string[] = [];
      if (edges.length > 0) {
        edges.forEach(e => {
          const fromText = nodesMap.get(e.from) || e.from;
          const toText = nodesMap.get(e.to) || e.to;
          const condition = e.label ? ` *(Se: ${e.label})*` : '';
          items.push(`**${fromText}**${condition} ➔ **${toText}**`);
        });
      } else {
        nodesMap.forEach((val) => {
          items.push(val);
        });
      }

      return [{ title: 'Protocolo Decisório Clínico (Visão Geral em Prosa)', items }];
    }

    // 2. Process ASCII / Flowchart / Sequential Text lines
    const rawLines = text.split('\n');
    const processedItems: { isHeader: boolean; text: string }[] = [];

    for (const rawLine of rawLines) {
      // Skip pure ASCII borders
      if (/^[\s\t\u2500-\u257F\-\+\|\+\=\*#▲▼◄►\•\[\]\(\)]+$/.test(rawLine.trim())) continue;

      // Strip border markers from edges
      const cleaned = rawLine
        .replace(/^[\s\t\u2500-\u257F\-\+\|\•▲▼┼┴┬┌┐└┘├┤\=\[\]\(\)]+/, '')
        .replace(/[\s\t\u2500-\u257F\-\+\|\•▲▼┼┴┬┌┐└┘├┤\=\[\]\(\)]+$/, '')
        .replace(/│/g, ' ')
        .replace(/─/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleaned || /^[▼↓▲↑→➔|\s\-\=]+$/.test(cleaned)) continue;

      const isHeader = /^#+\s+/i.test(cleaned) || 
                       /^ETAPA\s*\d+/i.test(cleaned) || 
                       /^PASSO\s*\d+/i.test(cleaned) || 
                       /^\d+\.\s+[A-Z\s]{4,}/.test(cleaned) ||
                       /^\[.*?\]$/.test(cleaned) ||
                       /^(?:FASE|PARTE|SEÇÃO)\s*\d+/i.test(cleaned);

      processedItems.push({ isHeader, text: cleaned });
    }

    if (processedItems.length === 0) {
      return [{ title: 'Roteiro Decisório em Texto', items: [text] }];
    }

    // Group into sections
    const groupedSections: { title: string; items: string[] }[] = [];
    let currentTitle = processedItems[0]?.text || 'Roteiro Decisório Clínico';
    let currentItems: string[] = [];

    for (let i = 0; i < processedItems.length; i++) {
      const item = processedItems[i];
      if (item.isHeader && currentItems.length > 0) {
        groupedSections.push({ title: currentTitle, items: currentItems });
        currentTitle = item.text.replace(/^#+\s*/, '').replace(/^\[/, '').replace(/\]$/, '').trim();
        currentItems = [];
      } else {
        if (i === 0 && !item.isHeader) {
          currentTitle = item.text;
        } else {
          currentItems.push(item.text);
        }
      }
    }

    if (currentItems.length > 0 || groupedSections.length === 0) {
      groupedSections.push({ 
        title: currentTitle, 
        items: currentItems.length > 0 ? currentItems : [processedItems[0]?.text || ''] 
      });
    }

    return groupedSections;
  }, [text]);

  if (sections.length === 0) return null;

  return (
    <div className="my-5 p-5 sm:p-6 bg-stone-50/80 rounded-2xl border-l-4 border-teal-600 border border-stone-200/80 text-stone-900 space-y-4 shadow-2xs">
      <div className="flex items-center gap-2 pb-2 border-b border-stone-200/80">
        <span className="w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0" />
        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-teal-950 m-0">
          Roteiro Decisório Clínico (Descrição em Prosa)
        </h4>
      </div>

      <div className="space-y-4 pt-1">
        {sections.map((sec, sIdx) => (
          <div key={sIdx} className="space-y-2">
            <h5 className="text-sm font-black text-stone-950 m-0 flex items-center gap-2">
              <span className="text-teal-700 font-bold">➔</span>
              <InlineClinicalText text={sec.title} />
            </h5>

            <div className="space-y-1.5 pl-3 sm:pl-4 border-l-2 border-stone-200">
              {sec.items.map((item, iIdx) => (
                <div key={iIdx} className="text-xs sm:text-sm font-bold text-stone-800 leading-relaxed flex items-start gap-2">
                  <span className="text-stone-400 font-bold shrink-0 mt-0.5">•</span>
                  <span className="flex-1 min-w-0">
                    <InlineClinicalText text={item} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const RefinedClinicalTextViewer = ({ 
  rootTitle, 
  rootNodes, 
  rawText 
}: { 
  rootTitle: string; 
  rootNodes: ClinicalTreeNode[]; 
  rawText?: string; 
}) => {
  return <TreeBranchRenderer text={rawText || rootTitle} />;
};

export const ClinicalAsciiDiagramViewer = ({ text }: { text: string }) => {
  return <TreeBranchRenderer text={text} />;
};

export const SequentialFlowRenderer = ({ text }: { text: string }) => {
  return <TreeBranchRenderer text={text} />;
};

export const VerticalFlowchartRenderer = ({ text }: { text: string }) => {
  return <TreeBranchRenderer text={text} />;
};

export const ClinicalEcgViewer = ({ text }: { text: string }) => {
  const [theme, setTheme] = useState<'paper' | 'dark'>('paper');

  // Extract initial BPM if present in text (e.g. "150 bpm", "FC: 140", "bpm: 180")
  const defaultBpm = useMemo(() => {
    const match = text.match(/(?:bpm|fc|frequência|frequencia)[:\s]*(\d{2,3})/i) || text.match(/(\d{2,3})\s*bpm/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed >= 30 && parsed <= 250) return parsed;
    }
    if (/trn|reentrada nodal|pseudo r'/i.test(text)) return 150;
    if (/taquicardia|flutter|fibrilação|fa\/flutter/i.test(text)) return 140;
    if (/bradicardia|bloqueio|bav/i.test(text)) return 48;
    return 75;
  }, [text]);

  const [bpm, setBpm] = useState<number>(defaultBpm);
  const [isAnimating, setIsAnimating] = useState<boolean>(true);
  const [showPromptTip, setShowPromptTip] = useState<boolean>(false);

  const rawText = text.trim();
  const isTrn = /trn|reentrada nodal|pseudo r'/i.test(text);
  const hasStDepression = /infra|depress/i.test(text);
  const hasStElevation = /supra|eleva/i.test(text);
  const isPosteriorMirror = /espelho|posterior/i.test(text);
  const hasHighR = /R alta|R\/S/i.test(text);
  const hasWideQRS = /alargad|bloqueio|bbr|bde|bdr|qrs alarg/i.test(text);
  const hasInvertedT = /t invert|t nega|onda t invert/i.test(text);
  const hasPeakedT = /t alta|t apiculad|hipercal/i.test(text);

  // Extract lead references from text (e.g. DII, V3, V4, etc.)
  const detectedLeads = useMemo(() => {
    const allLeads = ['DI', 'DII', 'DIII', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
    const textUpper = text.toUpperCase();
    return allLeads.filter(lead => {
      const regex = new RegExp(`\\b${lead}\\b`, 'i');
      return regex.test(textUpper);
    });
  }, [text]);

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const titleLine = lines.find(l => l.toLowerCase().includes('ecg') || l.toLowerCase().includes('traçado') || l.toLowerCase().includes('esboço') || l.toLowerCase().includes('derivaç') || l.toLowerCase().includes('supra')) || 'Eletrocardiograma (ECG) - Traçado Vetorial Interativo';

  // Dynamic Beat Path Generator based on BPM and Findings
  const { pathData, beatsCount } = useMemo(() => {
    const baselineY = 90;
    const canvasWidth = 600;
    // Map BPM to beat pixel width (Higher BPM -> Smaller width per beat)
    const beatWidth = Math.max(48, Math.min(220, 10000 / bpm));
    
    let currentX = 10;
    let pathStr = `M ${currentX} ${baselineY}`;
    let count = 0;

    while (currentX < canvasWidth) {
      count++;
      const w = beatWidth;

      // P wave
      const pStartX = currentX + w * 0.1;
      const pPeakX = currentX + w * 0.18;
      const pEndX = currentX + w * 0.25;

      // QRS Complex (wide QRS if detected)
      const qrsWidthFactor = hasWideQRS ? 1.4 : 1.0;
      const qX = currentX + w * 0.33;
      const rX = currentX + w * (0.42 * qrsWidthFactor);
      const sX = currentX + w * (0.50 * qrsWidthFactor);

      // ST & T wave
      const stStartX = currentX + w * 0.54;
      const tPeakX = currentX + w * 0.74;
      const tEndX = currentX + w * 0.90;

      // Elevations & Depressions & T wave morphology
      const rHeight = hasHighR ? 85 : 75;
      const stLevel = hasStElevation ? -28 : hasStDepression ? 22 : 0;
      const tAmpl = hasInvertedT ? 25 : hasPeakedT ? -38 : -20;

      pathStr += ` L ${pStartX} ${baselineY}`;
      pathStr += ` Q ${pPeakX} ${baselineY - 10} ${pEndX} ${baselineY}`;
      pathStr += ` L ${qX} ${baselineY + 12}`;
      pathStr += ` L ${rX} ${baselineY - rHeight}`;
      pathStr += ` L ${sX} ${baselineY + (isTrn ? 15 : 30)}`;

      if (isTrn) {
        // Pseudo r' notch
        const notchX = sX + w * 0.05;
        pathStr += ` L ${notchX} ${baselineY - 20} L ${notchX + w * 0.04} ${baselineY + 5}`;
      }

      pathStr += ` L ${stStartX} ${baselineY + stLevel}`;
      pathStr += ` Q ${tPeakX} ${baselineY + stLevel + tAmpl} ${tEndX} ${baselineY}`;
      
      currentX += w;
      pathStr += ` L ${Math.min(canvasWidth, currentX)} ${baselineY}`;
    }

    return { pathData: pathStr, beatsCount: count };
  }, [bpm, isTrn, hasStElevation, hasStDepression, hasHighR, hasWideQRS, hasInvertedT, hasPeakedT]);

  // Rhythm Classification
  const rhythmTag = useMemo(() => {
    if (bpm < 60) return { label: 'Bradicardia Sinusal', color: 'bg-sky-100 text-sky-900 border-sky-300' };
    if (bpm <= 100) return { label: 'Ritmo Sinusal Normal', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    if (bpm <= 150) return { label: 'Taquicardia Moderada', color: 'bg-amber-100 text-amber-900 border-amber-300' };
    return { label: 'Taquicardia Paroxística / Flutter', color: 'bg-rose-100 text-rose-900 border-rose-300' };
  }, [bpm]);

  return (
    <div className="my-6 rounded-2xl border border-stone-300 shadow-md overflow-hidden bg-white font-sans">
      {/* Header bar */}
      <div className="bg-stone-900 text-stone-100 px-5 py-3.5 flex items-center justify-between flex-wrap gap-3 border-b border-stone-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <Activity className={`w-5 h-5 ${bpm > 100 ? 'text-rose-400' : 'text-emerald-400'} animate-pulse shrink-0`} />
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-100 truncate">{titleLine}</h4>
            <p className="text-[11px] text-stone-400 font-medium truncate">Análise Dinâmica de Frequência Cardíaca (FC) & Ondas</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setShowPromptTip(!showPromptTip)}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border bg-stone-800 border-stone-700 text-amber-300 hover:bg-stone-700 transition-all flex items-center gap-1"
            title="Saber como usar este ECG nos capítulos"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Formação de Capítulos</span>
          </button>

          <button
            onClick={() => setTheme(t => t === 'paper' ? 'dark' : 'paper')}
            className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700"
          >
            {theme === 'paper' ? '🔴 Papel Rosa' : '🟢 Monitor CRT'}
          </button>
        </div>
      </div>

      {/* Chapter Authoring Tip Box */}
      {showPromptTip && (
        <div className="bg-amber-50 p-4 border-b border-amber-200 text-xs text-amber-900 leading-relaxed space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between font-bold text-amber-950">
            <span className="flex items-center gap-1.5 text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-600" /> Como Formatar/Gerar ECGs nos Capítulos Markdown:
            </span>
            <button onClick={() => setShowPromptTip(false)} className="text-amber-700 hover:text-amber-950">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p>
            Ao criar ou solicitar novos capítulos com o assistente, insira um bloco de código contendo o termo <strong>ECG</strong> e parâmetros como <strong>BPM: 150</strong>, <strong>Infradesnivelamento de ST</strong>, <strong>Supradesnivelamento</strong> ou <strong>TRN Típica</strong>:
          </p>
          <pre className="p-2.5 bg-amber-900/10 rounded-lg font-mono text-[11px] text-amber-950 whitespace-pre overflow-x-auto border border-amber-300">
{`\`\`\`ecg
Eletrocardiograma (ECG): Taquicardia Supraventricular (160 BPM)
FC: 160 bpm
Infradesnivelamento de ST de 2 mm em V4-V6
\`\`\``}
          </pre>
          <p className="text-[11px] opacity-80">
            O renderizador detectará automaticamente a frequência indicada e ajustará as ondas visualmente em tempo real.
          </p>
        </div>
      )}

      {/* BPM Heart Rate Controller Bar */}
      <div className="bg-stone-100 px-5 py-3 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-stone-900 text-white px-3 py-1.5 rounded-xl font-mono shadow-inner">
            <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
            <span className="text-lg font-extrabold">{bpm}</span>
            <span className="text-[10px] text-stone-400 uppercase font-sans">BPM</span>
          </div>

          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${rhythmTag.color}`}>
            {rhythmTag.label}
          </span>
        </div>

        {/* Interactive BPM Slider & Presets */}
        <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1 justify-end">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-300 shadow-xs">
            <span className="text-[11px] font-bold text-stone-600">FC:</span>
            <input
              type="range"
              min="30"
              max="220"
              step="1"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
              className="w-24 xs:w-32 accent-rose-600 cursor-pointer"
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1 text-[11px] font-bold">
            <button
              onClick={() => setBpm(45)}
              className={`px-2 py-1 rounded-md border transition-all ${bpm === 45 ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'}`}
              title="Bradicardia (45 BPM)"
            >
              45
            </button>
            <button
              onClick={() => setBpm(75)}
              className={`px-2 py-1 rounded-md border transition-all ${bpm === 75 ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'}`}
              title="Normal (75 BPM)"
            >
              75
            </button>
            <button
              onClick={() => setBpm(150)}
              className={`px-2 py-1 rounded-md border transition-all ${bpm === 150 ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'}`}
              title="Taquicardia (150 BPM)"
            >
              150
            </button>
            <button
              onClick={() => setBpm(190)}
              className={`px-2 py-1 rounded-md border transition-all ${bpm === 190 ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'}`}
              title="Flutter / SVT (190 BPM)"
            >
              190
            </button>
          </div>

          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-all ${isAnimating ? 'bg-stone-800 text-emerald-400 border-stone-700' : 'bg-white text-stone-500 border-stone-300'}`}
            title={isAnimating ? 'Pausar Varrer de Monitor' : 'Ativar Varrer de Monitor'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnimating ? 'animate-spin' : ''}`} style={{ animationDuration: `${Math.max(0.3, 60 / bpm)}s` }} />
          </button>
        </div>
      </div>

      {/* Clinical Findings Badges */}
      <div className="bg-stone-50 px-5 py-2.5 border-b border-stone-200 flex flex-wrap gap-2 text-xs font-semibold">
        {isTrn && (
          <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-md border border-emerald-300 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-600" /> V1: Pseudo r' (RP curto &lt; 70 ms) - TRN Típica
          </span>
        )}
        {hasHighR && (
          <span className="bg-blue-100 text-blue-900 px-2.5 py-1 rounded-md border border-blue-200 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-blue-600" /> V1/V2: Onda R Alta (R/S &gt; 1)
          </span>
        )}
        {hasStDepression && (
          <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md border border-amber-300 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Infradesnivelamento de ST (2 mm)
          </span>
        )}
        {hasStElevation && (
          <span className="bg-rose-100 text-rose-900 px-2.5 py-1 rounded-md border border-rose-300 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Supradesnivelamento de ST (Lesão Isquêmica)
          </span>
        )}
        {hasWideQRS && (
          <span className="bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-md border border-indigo-300 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-indigo-600" /> Complexo QRS Alargado (&gt; 120 ms)
          </span>
        )}
        {hasInvertedT && (
          <span className="bg-purple-100 text-purple-900 px-2.5 py-1 rounded-md border border-purple-300 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-purple-600" /> Onda T Invertida / Isquemia Subepicárdica
          </span>
        )}
        {hasPeakedT && (
          <span className="bg-orange-100 text-orange-900 px-2.5 py-1 rounded-md border border-orange-300 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-orange-600" /> Onda T Apiculada / Hipercalemia
          </span>
        )}
        {isPosteriorMirror && (
          <span className="bg-purple-100 text-purple-900 px-2.5 py-1 rounded-md border border-purple-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Imagem em Espelho (IAM Parede Posterior)
          </span>
        )}
        {detectedLeads.length > 0 && (
          <span className="bg-rose-900 text-rose-100 px-2.5 py-1 rounded-md border border-rose-800 font-mono text-[11px] font-bold flex items-center gap-1">
            Derivações com Alteração: {detectedLeads.join(', ')}
          </span>
        )}
        <span className="bg-stone-200/80 text-stone-800 px-2.5 py-1 rounded-md border border-stone-300 font-mono text-[11px]">
          {beatsCount} Complexos QRS na Janela
        </span>
      </div>

      {/* Dynamic SVG Waveform Canvas */}
      <div className={`p-4 sm:p-6 relative overflow-x-auto ${theme === 'paper' ? 'bg-[#fff5f5]' : 'bg-[#09131a]'}`}>
        <div className="min-w-[500px] flex flex-col items-center">
          <svg viewBox="0 0 600 160" className="w-full h-40 max-w-2xl drop-shadow-sm relative">
            <defs>
              <pattern id="grid-small" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke={theme === 'paper' ? '#ffcdd2' : '#1b382b'} strokeWidth="0.5" />
              </pattern>
              <pattern id="grid-large" width="50" height="50" patternUnits="userSpaceOnUse">
                <rect width="50" height="50" fill="url(#grid-small)" />
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke={theme === 'paper' ? '#ef9a9a' : '#2d6a4f'} strokeWidth="1.2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-large)" />

            {/* Standard 1mV / 10mm Calibration Pulse */}
            <path d="M 5 90 L 5 50 L 15 50 L 15 90" fill="none" stroke={theme === 'paper' ? '#b71c1c' : '#00ff87'} strokeWidth="2" />
            <text x="5" y="42" fill={theme === 'paper' ? '#b71c1c' : '#00ff87'} fontSize="8" fontWeight="bold">1mV/10mm</text>

            <line x1="0" y1="90" x2="600" y2="90" stroke={theme === 'paper' ? '#e57373' : '#40916c'} strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />

            {/* Dynamic Waveform Path based on FC/BPM */}
            <path
              d={pathData}
              fill="none"
              stroke={theme === 'paper' ? '#b71c1c' : '#00ff87'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Simulated Cardiac Sweep Line */}
            {isAnimating && (
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="160"
                stroke={theme === 'paper' ? '#e53935' : '#64ffda'}
                strokeWidth="3"
                opacity="0.8"
              >
                <animate
                  attributeName="x1"
                  from="0"
                  to="600"
                  dur={`${Math.max(0.8, 120 / bpm)}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="x2"
                  from="0"
                  to="600"
                  dur={`${Math.max(0.8, 120 / bpm)}s`}
                  repeatCount="indefinite"
                />
              </line>
            )}

            {/* Wave Labels */}
            {isTrn ? (
              <>
                <text x="50" y="20" fill={theme === 'paper' ? '#b71c1c' : '#00ff87'} fontSize="11" fontWeight="bold">R (V1)</text>
                <text x="75" y="58" fill={theme === 'paper' ? '#c62828' : '#ff5252'} fontSize="11" fontWeight="extrabold">↑ Pseudo r'</text>
              </>
            ) : (
              <>
                <text x="30" y="75" fill={theme === 'paper' ? '#b71c1c' : '#00ff87'} fontSize="11" fontWeight="bold">P</text>
                <text x="65" y="25" fill={theme === 'paper' ? '#b71c1c' : '#00ff87'} fontSize="12" fontWeight="bold">QRS</text>
              </>
            )}

            {hasStDepression && (
              <text x="140" y="128" fill={theme === 'paper' ? '#c62828' : '#ff5252'} fontSize="11" fontWeight="extrabold">↓ Infradesnivelamento ST</text>
            )}
            {hasStElevation && (
              <text x="140" y="50" fill={theme === 'paper' ? '#c62828' : '#ff5252'} fontSize="11" fontWeight="extrabold">↑ Supradesnivelamento ST</text>
            )}
            {!hasStDepression && !hasStElevation && !isTrn && (
              <text x="140" y="82" fill={theme === 'paper' ? '#b71c1c' : '#00ff87'} fontSize="11" fontWeight="bold">ST Isoelétrico</text>
            )}
          </svg>
        </div>
      </div>

      {/* Raw ECG Text output with 100% intact spacing & characters */}
      <div className="p-4 sm:p-5 bg-[#121212] text-stone-100 font-mono text-xs leading-relaxed overflow-x-auto border-t border-stone-800">
        <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-amber-400 mb-2.5">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> Laudo Esquemático & Anotação Técnica do Preceptor:
          </span>
          <span className="text-stone-500 font-normal">25 mm/s • 10 mm/mV</span>
        </div>
        <div className="bg-[#1a1a1a] p-3.5 rounded-xl border border-stone-800/80 shadow-inner">
          <pre className="m-0 font-mono whitespace-pre select-all text-emerald-300 leading-relaxed font-bold text-xs">{rawText}</pre>
        </div>
      </div>
    </div>
  );
};

export const ClinicalRadiologyViewer = ({ text }: { text: string }) => {
  const [pacsMode, setPacsMode] = useState<'dicom' | 'bone' | 'invert' | 'thermal'>('dicom');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedRegion, setSelectedRegion] = useState<string | null>('Pulmão Direito / Campo Pulmonar');

  const rawText = text.trim();
  const lowerText = rawText.toLowerCase();

  // Detect exam type
  const isCT = /tomografia|tc|corte axial|janela de mediastino|janela de pulm/i.test(rawText);
  const isMRI = /resson[aâ]ncia|rm|t1|t2|flair/i.test(rawText);
  const isUS = /ultrassom|usg|ecografia|ecocardiogram/i.test(rawText);
  const isXray = /raio-?x|rx|incid[êe]ncia|pa|perfil|ap/i.test(rawText) || (!isCT && !isMRI && !isUS);

  const examTypeTitle = isCT 
    ? 'Tomografia Computadorizada (TC)' 
    : isMRI 
    ? 'Ressonância Magnética (RM)' 
    : isUS 
    ? 'Ultrassonografia / Ecocardiograma' 
    : 'Radiografia Digital (Raio-X / RX)';

  // Key pathology detection for SVG annotations
  const hasRightConsolidation = /lobo inferior direito|lid|direito|base direita|ter[çc]o inferior direito|pulm[ãa]o direito/i.test(lowerText) && /condensa|opacida|infiltrad|consolida|pneumonia/i.test(lowerText);
  const hasLeftConsolidation = /lobo inferior esquerdo|lie|esquerdo|base esquerda|ter[çc]o inferior esquerdo|pulm[ãa]o esquerdo/i.test(lowerText) && /condensa|opacida|infiltrad|consolida|pneumonia/i.test(lowerText);
  const hasGeneralConsolidation = (hasRightConsolidation || hasLeftConsolidation || /condensa|opacida|infiltrad|consolida|pneumonia/i.test(lowerText));
  const hasPneumothorax = /pneumot[óo]rax|linha de pleura|hipertranspar[êe]ncia|aus[êe]ncia de trama/i.test(lowerText);
  const hasPleuralEffusion = /derrame pleural|apagamento do selo|apagamento de seio|velamento/i.test(lowerText);
  const hasCardiomegaly = /cardiomegalia|[ií]ndice cardiotor[áa]cico|aumento da [áa]rea card[íi]aca/i.test(lowerText);
  const hasNormalFindings = /sem altera[çc][õo]es|dentro dos limites|conservad|preservad|normal/i.test(lowerText) && !hasGeneralConsolidation && !hasPneumothorax && !hasPleuralEffusion;

  // Extract lines
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const titleLine = lines.find(l => /^#|laudo|exame|estudo/i.test(l))?.replace(/^#+\s*/, '') || examTypeTitle;

  // Parse structured findings
  const findingsList = useMemo(() => {
    return lines.filter(l => l.startsWith('-') || l.startsWith('*') || l.includes(':') || /^\d+\./.test(l)).map(l => {
      const clean = l.replace(/^[-*\d.]+\s*/, '');
      const parts = clean.split(':');
      if (parts.length >= 2) {
        return { label: parts[0].trim(), detail: parts.slice(1).join(':').trim() };
      }
      return { label: 'Achado', detail: clean };
    });
  }, [lines]);

  // Detailed region analytical data map for click feedback
  const regionDetailsMap: Record<string, { title: string; status: string; density: string; description: string; preceptorTip: string }> = {
    'Pulmão Direito / Campo Pulmonar': {
      title: 'Pulmão Direito (Anatomical Right - Lobos Superior, Médio e Inferior)',
      status: hasRightConsolidation ? 'OPACIDADE / CONDENSAÇÃO DETECTADA' : 'Transparência Mantida',
      density: hasRightConsolidation ? 'Infiltrado de Densidade de Partes Moles (-10 HU a +40 HU)' : 'Aeração Normal / Baixa Densidade (-800 HU)',
      description: hasRightConsolidation
        ? 'Presença de opacidade parenquimatosa em campo pulmonar direito com broncograma aéreo associado, compatível com consolidação pneumônica.'
        : 'Campos pulmonares direitos com transparência conservada, sem evidências de consolidações, nódulos ou massas.',
      preceptorTip: 'Dica de Prova: Consolidações em Lobo Inferior Direito podem apagar o hemidiafragma direito (sinal da silhueta positivos).'
    },
    'Pulmão Esquerdo / Campo Pulmonar': {
      title: 'Pulmão Esquerdo (Anatomical Left - Lobos Superior e Inferior / Língula)',
      status: hasLeftConsolidation ? 'OPACIDADE / CONDENSAÇÃO DETECTADA' : 'Transparência Mantida',
      density: hasLeftConsolidation ? 'Infiltrado de Densidade de Partes Moles (-10 HU a +40 HU)' : 'Aeração Normal / Baixa Densidade (-800 HU)',
      description: hasLeftConsolidation
        ? 'Presença de opacidade alveolar / opacidade parenquimatosa em campo pulmonar esquerdo.'
        : 'Campos pulmonares esquerdos limpos, trama vascular dentro da normalidade e transparência preservada.',
      preceptorTip: 'Dica de Prova: Lesões de Língula apagam o bordo cardíaco esquerdo sem apagar o hemidiafragma esquerdo.'
    },
    'Área Cardíaca & Mediastino': {
      title: 'Silhueta Cardíaca, Grandes Vasos & Mediastino',
      status: hasCardiomegaly ? 'CARDIOMEGALIA / ICT > 0.50' : 'Silhueta Cardíaca Conservada',
      density: 'Partes Moles & Conteúdo Hídrico (+30 HU a +60 HU)',
      description: hasCardiomegaly
        ? 'Aumento da área cardíaca às custas de ventrículo esquerdo com Índice Cardiotorácico (ICT) superior a 0,50 na incidência PA.'
        : 'Índice cardiotorácico mantido dentro dos limites normais (< 0,50). Mediastino centrado e sem alargamentos.',
      preceptorTip: 'Dica de Prova: O ICT só deve ser calculado em radiografias ortostáticas em PA (Posteroanterior); no AP de leito há magnificação da área cardíaca.'
    },
    'Cúpulas Diafragmáticas & Pleura': {
      title: 'Hemidiafragmas & Seios Pleurais Costa-Frênicos',
      status: hasPleuralEffusion ? 'DERRAME PLEURAL / VELAMENTO COSTOFRÊNICO' : 'Seios Libres e Agudos',
      density: hasPleuralEffusion ? 'Densidade Líquida Pleurórica (+10 HU a +20 HU)' : 'Interfase Ar-Tecido Conservada',
      description: hasPleuralEffusion
        ? 'Apagamento do seio costofrênico lateral com menisco pleural evidente, indicando derrame pleural de moderado volume.'
        : 'Cúpulas diafragmáticas com contornos regulares e seios costofrênicos livres e bem definidos.',
      preceptorTip: 'Dica de Prova: A incidência de Laurell (decúbito lateral com raios horizontais) detecta derrames pleurais a partir de 50 mL.'
    },
    'Estruturas Ósseas & Parede Torácica': {
      title: 'Arcos Costais, Clavículas & Coluna Torácica',
      status: 'Arcos Costais Integrais',
      density: 'Densidade Cálcica / Óssea (+300 HU a +1000 HU)',
      description: 'Arcos costais sem solução de continuidade, descalcificações patológicas ou traços de fratura evidentes.',
      preceptorTip: 'Dica de Prova: Fraturas dos 1º e 2º arcos costais indicam trauma torácico de alta energia (risco de lesão de grandes vasos).'
    }
  };

  const currentRegionDetail = selectedRegion ? regionDetailsMap[selectedRegion] || regionDetailsMap['Pulmão Direito / Campo Pulmonar'] : regionDetailsMap['Pulmão Direito / Campo Pulmonar'];

  return (
    <div className="my-6 rounded-2xl border border-stone-800 bg-[#0c0d0e] text-stone-100 overflow-hidden shadow-2xl font-sans">
      {/* PACS Header Bar */}
      <div className="bg-[#141618] px-4 py-3 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/80">
                PACS / DICOM WORKSTATION
              </span>
              <span className="text-xs font-bold text-stone-100">{titleLine}</span>
            </div>
            <div className="text-[11px] font-mono text-stone-400 mt-0.5">
              MODALITY: <span className="text-stone-100 font-bold">{isCT ? 'CT' : isMRI ? 'MR' : isUS ? 'US' : 'CR/DX'}</span> • WINDOW: <span className="text-stone-100 font-bold">{isCT ? 'LUNG/SOFT' : 'STANDARD'}</span> • INTERACTIVE PACS
            </div>
          </div>
        </div>

        {/* PACS Window / Display Modes */}
        <div className="flex items-center gap-1.5 bg-[#0a0b0c] p-1 rounded-xl border border-stone-800">
          <button
            onClick={() => setPacsMode('dicom')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all ${pacsMode === 'dicom' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-stone-400 hover:text-stone-200'}`}
            title="Modo DICOM Padrão (Radiologia Clássica)"
          >
            DICOM
          </button>
          <button
            onClick={() => setPacsMode('bone')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all ${pacsMode === 'bone' ? 'bg-amber-600 text-white font-bold shadow' : 'text-stone-400 hover:text-stone-200'}`}
            title="Janela Óssea / Alto Contraste"
          >
            ÓSSEO
          </button>
          <button
            onClick={() => setPacsMode('invert')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all ${pacsMode === 'invert' ? 'bg-purple-600 text-white font-bold shadow' : 'text-stone-400 hover:text-stone-200'}`}
            title="Invertido Negativo"
          >
            INVERT
          </button>
          <button
            onClick={() => setPacsMode('thermal')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all ${pacsMode === 'thermal' ? 'bg-rose-600 text-white font-bold shadow' : 'text-stone-400 hover:text-stone-200'}`}
            title="Mapa Perfusional / Térmico"
          >
            TÉRMICO
          </button>
          <div className="h-4 w-px bg-stone-800 mx-1" />
          <button
            onClick={() => setZoomLevel(prev => prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : 1)}
            className="p-1.5 text-stone-300 hover:text-white rounded-lg hover:bg-stone-800 transition-all text-xs font-mono font-bold"
            title="Aumentar Zoom do Corte Radiológico"
          >
            {zoomLevel}x
          </button>
        </div>
      </div>

      {/* Main Radiology Canvas & Interactive Anatomy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-stone-800">
        {/* Left Interactive SVG Anatomical Diagram */}
        <div className={`lg:col-span-5 p-5 flex flex-col items-center justify-between relative min-h-[360px] transition-all duration-300 ${
          pacsMode === 'dicom' ? 'bg-[#050607]' :
          pacsMode === 'bone' ? 'bg-[#0f1115]' :
          pacsMode === 'invert' ? 'bg-[#121018]' : 'bg-[#0a050d]'
        }`}>
          {/* DICOM Overlay Stats */}
          <div className="w-full flex items-center justify-between font-mono text-[10px] text-cyan-400 mb-2 select-none">
            <div>PATIENT: SIMULATION_PACS</div>
            <div>EXAM: {isCT ? 'CHEST_CT_AXIAL' : 'CHEST_XRAY_PA'}</div>
          </div>

          {/* Anatomical Schematic SVG with Full Region Click Targets */}
          <div className="w-full max-w-[290px] my-2 transition-transform duration-300 flex items-center justify-center" style={{ transform: `scale(${zoomLevel})` }}>
            <svg viewBox="0 0 240 280" className="w-full h-auto drop-shadow-xl select-none cursor-pointer">
              {/* Outer Thorax / Ribcage */}
              <path
                d="M 60 40 Q 120 20 180 40 Q 210 100 205 220 Q 120 240 35 220 Q 30 100 60 40 Z"
                fill={pacsMode === 'bone' ? '#22262b' : pacsMode === 'thermal' ? '#1c092b' : '#14171a'}
                stroke={selectedRegion === 'Estruturas Ósseas & Parede Torácica' ? '#00f0ff' : '#334155'}
                strokeWidth={selectedRegion === 'Estruturas Ósseas & Parede Torácica' ? '3' : '2'}
                className="hover:opacity-80 transition-all"
                onClick={() => setSelectedRegion('Estruturas Ósseas & Parede Torácica')}
              />

              {/* Rib Cage Lines */}
              <g onClick={() => setSelectedRegion('Estruturas Ósseas & Parede Torácica')}>
                <path d="M 60 50 Q 120 65 180 50" fill="none" stroke="#64748b" strokeWidth="2.5" opacity="0.8" />
                <path d="M 50 80 Q 120 95 190 80" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
                <path d="M 45 110 Q 120 125 195 110" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
                <path d="M 42 140 Q 120 155 198 140" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
                <path d="M 40 170 Q 120 185 200 170" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="120" y1="40" x2="120" y2="230" stroke="#94a3b8" strokeWidth="4" strokeDasharray="6 2" opacity="0.7" />
              </g>

              {/* Right Lung Field (Anatomical Right = Left side on SVG) */}
              <path
                d="M 65 60 Q 110 65 110 190 Q 70 200 50 180 Q 45 110 65 60 Z"
                fill={
                  hasRightConsolidation || (hasGeneralConsolidation && !hasLeftConsolidation)
                    ? (pacsMode === 'thermal' ? '#f43f5e' : '#cbd5e1') 
                    : (pacsMode === 'bone' ? '#080a0c' : pacsMode === 'thermal' ? '#0f172a' : '#030712')
                }
                stroke={selectedRegion === 'Pulmão Direito / Campo Pulmonar' ? '#00f0ff' : '#334155'}
                strokeWidth={selectedRegion === 'Pulmão Direito / Campo Pulmonar' ? '3' : '1.5'}
                className="cursor-pointer transition-all hover:opacity-90"
                onClick={(e) => { e.stopPropagation(); setSelectedRegion('Pulmão Direito / Campo Pulmonar'); }}
              />

              {/* Left Lung Field (Anatomical Left = Right side on SVG) */}
              <path
                d="M 175 60 Q 130 65 130 190 Q 170 200 190 180 Q 195 110 175 60 Z"
                fill={
                  hasLeftConsolidation 
                    ? (pacsMode === 'thermal' ? '#f43f5e' : '#cbd5e1') 
                    : (pacsMode === 'bone' ? '#080a0c' : pacsMode === 'thermal' ? '#0f172a' : '#030712')
                }
                stroke={selectedRegion === 'Pulmão Esquerdo / Campo Pulmonar' ? '#00f0ff' : '#334155'}
                strokeWidth={selectedRegion === 'Pulmão Esquerdo / Campo Pulmonar' ? '3' : '1.5'}
                className="cursor-pointer transition-all hover:opacity-90"
                onClick={(e) => { e.stopPropagation(); setSelectedRegion('Pulmão Esquerdo / Campo Pulmonar'); }}
              />

              {/* Cardiac Silhouette / Mediastinum */}
              <path
                d="M 112 110 Q 145 125 140 180 Q 115 190 108 170 Z"
                fill={hasCardiomegaly ? '#64748b' : '#334155'}
                stroke={selectedRegion === 'Área Cardíaca & Mediastino' ? '#00f0ff' : '#64748b'}
                strokeWidth={selectedRegion === 'Área Cardíaca & Mediastino' ? '3' : '1.5'}
                opacity="0.85"
                className="cursor-pointer hover:opacity-100 transition-all"
                onClick={(e) => { e.stopPropagation(); setSelectedRegion('Área Cardíaca & Mediastino'); }}
              />

              {/* Diaphragmatic Hemicupolas & Costophrenic Angles */}
              <g onClick={(e) => { e.stopPropagation(); setSelectedRegion('Cúpulas Diafragmáticas & Pleura'); }} className="cursor-pointer">
                <path d="M 40 195 Q 80 180 115 195" fill="none" stroke={selectedRegion === 'Cúpulas Diafragmáticas & Pleura' ? '#00f0ff' : '#94a3b8'} strokeWidth={selectedRegion === 'Cúpulas Diafragmáticas & Pleura' ? '3' : '2'} />
                <path d="M 125 195 Q 160 180 200 195" fill="none" stroke={selectedRegion === 'Cúpulas Diafragmáticas & Pleura' ? '#00f0ff' : '#94a3b8'} strokeWidth={selectedRegion === 'Cúpulas Diafragmáticas & Pleura' ? '3' : '2'} />
              </g>

              {/* Right Consolidation Highlight Flare */}
              {(hasRightConsolidation || (hasGeneralConsolidation && !hasLeftConsolidation)) && (
                <g onClick={(e) => { e.stopPropagation(); setSelectedRegion('Pulmão Direito / Campo Pulmonar'); }}>
                  <circle cx="75" cy="165" r="22" fill="#ef4444" opacity="0.35" className="animate-pulse" />
                  <circle cx="75" cy="165" r="12" fill="#dc2626" opacity="0.7" />
                  <text x="75" y="169" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">OPACIDADE</text>
                </g>
              )}

              {/* Left Consolidation Highlight Flare */}
              {hasLeftConsolidation && (
                <g onClick={(e) => { e.stopPropagation(); setSelectedRegion('Pulmão Esquerdo / Campo Pulmonar'); }}>
                  <circle cx="165" cy="165" r="22" fill="#ef4444" opacity="0.35" className="animate-pulse" />
                  <circle cx="165" cy="165" r="12" fill="#dc2626" opacity="0.7" />
                  <text x="165" y="169" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">OPACIDADE</text>
                </g>
              )}

              {/* Pneumothorax Line Overlay */}
              {hasPneumothorax && (
                <g onClick={(e) => { e.stopPropagation(); setSelectedRegion('Pulmão Esquerdo / Campo Pulmonar'); }}>
                  <path d="M 180 70 Q 185 120 182 170" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" className="animate-pulse" />
                  <text x="185" y="110" fill="#38bdf8" fontSize="8" fontWeight="bold">PLEURA</text>
                </g>
              )}

              {/* Pleural Effusion Blunting */}
              {hasPleuralEffusion && (
                <path d="M 40 195 Q 60 190 75 198 L 40 205 Z" fill="#38bdf8" opacity="0.8" onClick={(e) => { e.stopPropagation(); setSelectedRegion('Cúpulas Diafragmáticas & Pleura'); }} />
              )}
            </svg>
          </div>

          {/* Quick Region Selector Buttons */}
          <div className="w-full grid grid-cols-2 gap-1.5 mt-2">
            <button
              onClick={() => setSelectedRegion('Pulmão Direito / Campo Pulmonar')}
              className={`px-2 py-1 text-[10px] font-mono rounded border transition-all text-left truncate ${
                selectedRegion === 'Pulmão Direito / Campo Pulmonar' ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold' : 'bg-[#101214] border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              • Pulmão Direito (D)
            </button>
            <button
              onClick={() => setSelectedRegion('Pulmão Esquerdo / Campo Pulmonar')}
              className={`px-2 py-1 text-[10px] font-mono rounded border transition-all text-left truncate ${
                selectedRegion === 'Pulmão Esquerdo / Campo Pulmonar' ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold' : 'bg-[#101214] border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              • Pulmão Esquerdo (E)
            </button>
            <button
              onClick={() => setSelectedRegion('Área Cardíaca & Mediastino')}
              className={`px-2 py-1 text-[10px] font-mono rounded border transition-all text-left truncate ${
                selectedRegion === 'Área Cardíaca & Mediastino' ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold' : 'bg-[#101214] border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              • Coração / Mediastino
            </button>
            <button
              onClick={() => setSelectedRegion('Cúpulas Diafragmáticas & Pleura')}
              className={`px-2 py-1 text-[10px] font-mono rounded border transition-all text-left truncate ${
                selectedRegion === 'Cúpulas Diafragmáticas & Pleura' ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold' : 'bg-[#101214] border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              • Diafragma & Pleura
            </button>
          </div>
        </div>

        {/* Right Interactive Structural Report & Inspection Panel */}
        <div className="lg:col-span-7 p-5 bg-[#0f1113] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-stone-800 pb-2">
              <span className="text-xs font-mono font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-400" /> Relatório Radiológico & Inspetor
              </span>
              <span className="text-[10px] font-mono text-stone-300 bg-stone-800 px-2 py-0.5 rounded">
                CBR / ACCR STANDARD
              </span>
            </div>

            {/* Active Anatomical Region Inspector Box (Appears on click!) */}
            <div className="bg-[#161a1e] p-3.5 rounded-xl border border-cyan-800/80 mb-4 shadow-lg">
              <div className="flex items-center justify-between mb-1.5 border-b border-stone-800 pb-1">
                <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  {currentRegionDetail.title}
                </span>
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {currentRegionDetail.status}
                </span>
              </div>
              <p className="text-xs text-stone-200 leading-relaxed font-mono m-0 mb-2">
                {currentRegionDetail.description}
              </p>
              <div className="text-[11px] font-mono text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-800/50">
                💡 <strong className="text-amber-200">Inspetor Clínico:</strong> {currentRegionDetail.preceptorTip}
              </div>
            </div>

            {/* Findings List */}
            <div className="space-y-2 mb-4">
              <div className="text-[10px] font-mono uppercase font-bold text-stone-400 tracking-wider">
                Achados do Laudo por Estrutura:
              </div>
              {findingsList.map((item, idx) => (
                <div key={idx} className="bg-[#181a1d] p-2.5 rounded-lg border border-stone-800 flex items-start gap-2 text-xs">
                  <span className="text-amber-400 font-mono font-bold shrink-0 mt-0.5">•</span>
                  <div>
                    <span className="font-bold text-stone-100">{item.label}: </span>
                    <span className="text-stone-300 leading-relaxed">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Conclusion / Impression Box */}
          <div className="bg-gradient-to-r from-amber-950/50 via-stone-900 to-stone-900 border border-amber-800/60 p-3.5 rounded-xl shadow-inner mt-2">
            <div className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-amber-400 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> IMPRESSÃO DIAGNÓSTICA DO PRECEPTOR
            </div>
            <p className="text-xs text-amber-100 font-mono leading-relaxed m-0 font-medium">
              {rawText.includes('Conclusão') || rawText.includes('IMPRESSÃO') || rawText.includes('Impressão')
                ? rawText.split(/(?:Conclusão|IMPRESSÃO|Impressão):/i).pop()?.trim()
                : 'Laudo compatível com as alterações descritas. Recomenda-se correlação clínica e acompanhamento segundo diretrizes vigentes.'}
            </p>
          </div>
        </div>
      </div>

      {/* Raw Report Footer Transcript */}
      <div className="p-3.5 bg-[#0a0a0c] text-stone-300 font-mono text-xs leading-relaxed overflow-x-auto border-t border-stone-800">
        <details className="group">
          <summary className="cursor-pointer text-[10px] uppercase font-bold tracking-widest text-stone-400 hover:text-stone-200 flex items-center justify-between select-none">
            <span>Transcrição Íntegra do Laudo de Imagem</span>
            <span className="text-stone-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <pre className="mt-2.5 m-0 font-mono whitespace-pre select-all text-amber-200/90 bg-[#121316] p-3 rounded-lg border border-stone-800/80 leading-relaxed font-normal text-xs">
            {rawText}
          </pre>
        </details>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 1. CLINICAL GASOMETRY & ACID-BASE BALANCE INTERPRETER                    */
/* ========================================================================== */
export const ClinicalGasometryViewer = ({ text }: { text: string }) => {
  const rawText = text.trim();
  const lowerText = rawText.toLowerCase();

  // Helper numeric extractor
  const extractVal = (pattern: RegExp): number | null => {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Values extraction
  const ph = extractVal(/ph\s*[:=]?\s*(\d+[.,]\d+)/i) ?? (lowerText.includes('ph 7') ? parseFloat(rawText.match(/ph\s*(7[.,]\d+)/i)?.[1].replace(',', '.') || '7.40') : 7.40);
  const pco2 = extractVal(/pco2\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 40;
  const hco3 = extractVal(/hco3\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 24;
  const pao2 = extractVal(/pao2\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 90;
  const fio2 = extractVal(/fio2\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 21; // in %
  const be = extractVal(/(?:be|base excess)\s*[:=]?\s*([-+]?\d+[.,]?\d*)/i) ?? 0;
  const anionGap = extractVal(/(?:anion gap|ag)\s*[:=]?\s*(\d+[.,]?\d*)/i);
  const na = extractVal(/na\s*[:=]?\s*(\d+)/i);
  const cl = extractVal(/cl\s*[:=]?\s*(\d+)/i);

  // Calculated Anion Gap if Na & Cl available
  const calculatedAG = anionGap ?? (na && cl ? na - (cl + hco3) : null);

  // PaO2 / FiO2 Ratio
  const fio2Decimal = fio2 > 1 ? fio2 / 100 : (fio2 || 0.21);
  const paO2FiO2 = pao2 && fio2Decimal ? Math.round(pao2 / fio2Decimal) : null;

  // Acid-Base Classification
  let primaryDisorder = 'Equilíbrio Ácido-Base Normal';
  let isAcidemia = ph < 7.35;
  let isAlkalemia = ph > 7.45;
  let respComponent = pco2 > 45 ? 'acid' : pco2 < 35 ? 'alkal' : 'normal';
  let metabComponent = hco3 < 22 ? 'acid' : hco3 > 26 ? 'alkal' : 'normal';

  if (isAcidemia) {
    if (metabComponent === 'acid' && respComponent === 'acid') primaryDisorder = 'Acidose Mista (Metabólica e Respiratória)';
    else if (metabComponent === 'acid') primaryDisorder = calculatedAG && calculatedAG > 12 ? 'Acidose Metabólica com Anion Gap Elevado' : 'Acidose Metabólica Hiperclorêmica (Anion Gap Normal)';
    else if (respComponent === 'acid') primaryDisorder = 'Acidose Respiratória';
    else primaryDisorder = 'Acidose Primária Descompensada';
  } else if (isAlkalemia) {
    if (metabComponent === 'alkal' && respComponent === 'alkal') primaryDisorder = 'Alcalose Mista (Metabólica e Respiratória)';
    else if (metabComponent === 'alkal') primaryDisorder = 'Alcalose Metabólica';
    else if (respComponent === 'alkal') primaryDisorder = 'Alcalose Respiratória';
    else primaryDisorder = 'Alcalose Primária Descompensada';
  } else {
    if (metabComponent === 'acid' && respComponent === 'alkal') primaryDisorder = 'Distúrbio Misto: Acidose Metabólica + Alcalose Respiratória';
    else if (metabComponent === 'alkal' && respComponent === 'acid') primaryDisorder = 'Distúrbio Misto: Alcalose Metabólica + Acidose Respiratória';
    else if (pco2 !== 40 || hco3 !== 24) primaryDisorder = 'Distúrbio Ácido-Base Compensado';
  }

  // Oxygenation Status
  let oxygenationStatus = 'Normoxemia';
  if (pao2 < 60) oxygenationStatus = 'Hipoxemia Grave / Insuficiência Respiratória Aguda';
  else if (pao2 < 80) oxygenationStatus = 'Hipoxemia Leve a Moderada';

  return (
    <div className="my-6 rounded-2xl border border-stone-800 bg-[#0b0f14] text-stone-100 overflow-hidden shadow-2xl font-sans">
      {/* Header */}
      <div className="bg-[#141b24] px-4 py-3 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div>
            <div className="text-xs font-mono font-black uppercase tracking-wider text-emerald-400">
              INTERPRETADOR DE GASOMETRIA ARTERIAL & EQUILÍBRIO ÁCIDO-BASE
            </div>
            <div className="text-[11px] font-mono text-stone-400">
              Amostra Arterial • Análise de Davenport & Relação PaO₂/FiO₂
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-2.5 py-1 rounded-md">
          {primaryDisorder.includes('Normal') ? 'NORMAL' : 'ALTERAÇÃO CRÍTICA'}
        </span>
      </div>

      {/* Main Diagnostic Dashboard */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 border-b border-stone-800/80">
        {/* Left Acid-Base Balance Beam Gauge */}
        <div className="lg:col-span-5 bg-[#10161d] p-4 rounded-xl border border-stone-800 flex flex-col justify-between items-center text-center">
          <div className="text-[10px] font-mono uppercase font-black tracking-widest text-stone-400 mb-2">
            BALANÇA ÁCIDO-BASE DE DAVENPORT
          </div>

          <div className="w-full my-3 flex flex-col items-center">
            {/* Scale Graphic */}
            <div className="w-full max-w-[220px] relative">
              <svg viewBox="0 0 200 100" className="w-full h-auto">
                {/* Arc */}
                <path d="M 20 80 A 80 80 0 0 1 180 80" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                <path d="M 20 80 A 80 80 0 0 1 80 25" fill="none" stroke="#ef4444" strokeWidth="8" opacity="0.8" />
                <path d="M 80 25 A 80 80 0 0 1 120 25" fill="none" stroke="#10b981" strokeWidth="10" />
                <path d="M 120 25 A 80 80 0 0 1 180 80" fill="none" stroke="#3b82f6" strokeWidth="8" opacity="0.8" />

                {/* Pointer Needle */}
                {(() => {
                  const clampPh = Math.max(6.8, Math.min(7.6, ph));
                  const angle = ((clampPh - 6.8) / (7.6 - 6.8)) * 180 - 90; // -90 to +90
                  const rad = (angle * Math.PI) / 180;
                  const nx = 100 + 65 * Math.sin(rad);
                  const ny = 80 - 65 * Math.cos(rad);
                  return (
                    <g>
                      <line x1="100" y1="80" x2={nx} y2={ny} stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
                      <circle cx="100" cy="80" r="6" fill="#f59e0b" />
                    </g>
                  );
                })()}
              </svg>
            </div>

            <div className="text-2xl font-mono font-black text-white mt-1">
              pH {ph.toFixed(2)}
            </div>
            <div className={`text-xs font-mono font-bold mt-0.5 ${ph < 7.35 ? 'text-rose-400' : ph > 7.45 ? 'text-blue-400' : 'text-emerald-400'}`}>
              {ph < 7.35 ? 'ACIDEMIA' : ph > 7.45 ? 'ALCALEMIA' : 'pH Fisiológico (7.35 - 7.45)'}
            </div>
          </div>

          <div className="w-full bg-[#0a0d12] p-3 rounded-lg border border-stone-800/80 text-left text-xs font-mono">
            <div className="text-[10px] text-amber-400 font-bold uppercase mb-1">Diagnóstico Primário:</div>
            <div className="text-stone-100 font-bold">{primaryDisorder}</div>
          </div>
        </div>

        {/* Right Parameter Grid */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* pH */}
          <div className="bg-[#10161d] p-3 rounded-xl border border-stone-800">
            <div className="text-[10px] font-mono text-stone-400 font-bold uppercase">pH Arterial</div>
            <div className="text-lg font-mono font-black text-stone-100 mt-1">{ph.toFixed(2)}</div>
            <div className="text-[10px] font-mono text-stone-400 mt-0.5">Ref: 7.35 - 7.45</div>
          </div>

          {/* pCO2 */}
          <div className="bg-[#10161d] p-3 rounded-xl border border-stone-800">
            <div className="text-[10px] font-mono text-stone-400 font-bold uppercase">pCO₂ (Respiratório)</div>
            <div className={`text-lg font-mono font-black mt-1 ${pco2 > 45 ? 'text-rose-400' : pco2 < 35 ? 'text-sky-400' : 'text-stone-100'}`}>
              {pco2} <span className="text-xs font-normal">mmHg</span>
            </div>
            <div className="text-[10px] font-mono text-stone-400 mt-0.5">Ref: 35 - 45 mmHg</div>
          </div>

          {/* HCO3 */}
          <div className="bg-[#10161d] p-3 rounded-xl border border-stone-800">
            <div className="text-[10px] font-mono text-stone-400 font-bold uppercase">HCO₃⁻ (Metabólico)</div>
            <div className={`text-lg font-mono font-black mt-1 ${hco3 < 22 ? 'text-rose-400' : hco3 > 26 ? 'text-sky-400' : 'text-stone-100'}`}>
              {hco3} <span className="text-xs font-normal">mEq/L</span>
            </div>
            <div className="text-[10px] font-mono text-stone-400 mt-0.5">Ref: 22 - 26 mEq/L</div>
          </div>

          {/* Base Excess */}
          <div className="bg-[#10161d] p-3 rounded-xl border border-stone-800">
            <div className="text-[10px] font-mono text-stone-400 font-bold uppercase">Base Excess (BE)</div>
            <div className="text-lg font-mono font-black text-stone-100 mt-1">{be > 0 ? `+${be}` : be} mEq/L</div>
            <div className="text-[10px] font-mono text-stone-400 mt-0.5">Ref: -2.0 a +2.0</div>
          </div>

          {/* PaO2 / FiO2 */}
          <div className="bg-[#10161d] p-3 rounded-xl border border-stone-800">
            <div className="text-[10px] font-mono text-stone-400 font-bold uppercase">PaO₂ / FiO₂</div>
            <div className={`text-lg font-mono font-black mt-1 ${paO2FiO2 && paO2FiO2 < 300 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {paO2FiO2 ? `${paO2FiO2}` : `${pao2} mmHg`}
            </div>
            <div className="text-[10px] font-mono text-stone-400 mt-0.5">{paO2FiO2 ? (paO2FiO2 < 200 ? 'SDRA Moderada/Grave' : paO2FiO2 < 300 ? 'SDRA Leve' : 'Troca Normal (>300)') : 'PaO₂ Isolada'}</div>
          </div>

          {/* Anion Gap */}
          <div className="bg-[#10161d] p-3 rounded-xl border border-stone-800">
            <div className="text-[10px] font-mono text-stone-400 font-bold uppercase">Anion Gap</div>
            <div className={`text-lg font-mono font-black mt-1 ${calculatedAG && calculatedAG > 12 ? 'text-rose-400' : 'text-stone-100'}`}>
              {calculatedAG ? `${calculatedAG.toFixed(1)}` : 'N/A'} <span className="text-xs font-normal">mEq/L</span>
            </div>
            <div className="text-[10px] font-mono text-stone-400 mt-0.5">Ref: 8 - 12 mEq/L</div>
          </div>
        </div>
      </div>

      {/* Impression / Formula Notes */}
      <div className="p-4 bg-[#080b0e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-stone-300">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Fórmula de Winter (Compensação): <strong className="text-emerald-300">pCO₂ esperada = (1.5 × HCO₃⁻) + 8 ± 2</strong></span>
        </div>
        <span className="text-[10px] text-stone-500 bg-stone-900 px-2 py-1 rounded border border-stone-800">
          Status Oxigenação: {oxygenationStatus}
        </span>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 2. CLINICAL HEMOGRAM & MIELOGRAM INTERPRETER                              */
/* ========================================================================== */
export const ClinicalHemogramViewer = ({ text }: { text: string }) => {
  const rawText = text.trim();
  const lowerText = rawText.toLowerCase();

  const extractVal = (pattern: RegExp): number | null => {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Erythrocytes & Hemoglobin
  const hb = extractVal(/(?:hemoglobina|hb)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 14.0;
  const ht = extractVal(/(?:hemat[óo]crito|ht)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 42.0;
  const vcm = extractVal(/vcm\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 88.0;
  const hcm = extractVal(/hcm\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 29.0;
  const rdw = extractVal(/rdw\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 12.5;

  // Leukocytes
  const leucocytes = extractVal(/(?:leuc[óo]citos|global)\s*[:=]?\s*(\d+[\.\,]?\d*)/i) ?? 7500;
  const bastoes = extractVal(/(?:bast[õo]es|bastonetes)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 2;
  const segs = extractVal(/(?:segmentados|neutr[óo]filos)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 60;
  const lymph = extractVal(/linf[óo]citos\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 28;
  const mono = extractVal(/mon[óo]citos\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 6;
  const eosin = extractVal(/eosin[óo]filos\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 2;

  // Platelets
  const platelets = extractVal(/(?:plaquetas)\s*[:=]?\s*(\d+[\.\,]?\d*)/i) ?? 240000;

  // Erythrocytic Diagnoses
  let anemiaType = 'Série Vermelha Preservada (Sem Anemia)';
  if (hb < 12) {
    if (vcm < 80) anemiaType = 'Anemia Microcítica e Hipocrômica (ex: Ferropriva, Talassemia)';
    else if (vcm > 100) anemiaType = 'Anemia Macrocítica (ex: Megaloblástica - B12/Folato, Etilismo)';
    else anemiaType = 'Anemia Normocítica e Normocrômica (ex: Doença Crônica, Sangramento Agudo)';
  }

  // Leukocytic Diagnoses
  let leucoType = 'Série Branca Normal';
  if (leucocytes > 11000) {
    if (bastoes > 5 || lowerText.includes('desvio à esquerda')) leucoType = 'Leucocitose com Desvio à Esquerda (Bastonose - Infecção Bacteriana Aguda)';
    else leucoType = 'Leucocitose Reacional';
  } else if (leucocytes < 4000) {
    leucoType = 'Leucopenia / Neutropenia (Atencao para Risco Infeccioso)';
  } else if (bastoes > 5 || lowerText.includes('desvio à esquerda')) {
    leucoType = 'Desvio à Esquerda sem Leucocitose (Infecção Oculta / Sepse Inicial)';
  }

  // Platelet Diagnoses
  let plateletType = 'Plaquetas Normais';
  if (platelets < 150000) {
    if (platelets < 50000) plateletType = 'Trombocitopenia Severa (< 50.000/mm³ - Risco de Sangramento)';
    else plateletType = 'Trombocitopenia Moderada';
  } else if (platelets > 450000) {
    plateletType = 'Trombocitose (Atração Inflamatória ou Mieloproliferativa)';
  }

  return (
    <div className="my-6 rounded-2xl border border-stone-800 bg-[#0d0f12] text-stone-100 overflow-hidden shadow-2xl font-sans">
      {/* Header */}
      <div className="bg-[#181a1e] px-4 py-3 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shrink-0" />
          <div>
            <div className="text-xs font-mono font-black uppercase tracking-wider text-rose-400">
              LAUDO DE HEMOGRAMA COMPLETO & LEUCOGRAMA DIVERSIFICADO
            </div>
            <div className="text-[11px] font-mono text-stone-400">
              Automatizado com Contagem Diferencial & Índices Hematimétricos
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 px-2.5 py-1 rounded-md">
          {hb < 10 || leucocytes > 15000 || platelets < 100000 ? 'ALERTA HEMATOLÓGICO' : 'EUTROFIA'}
        </span>
      </div>

      {/* Tri-Series Panel */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-stone-800">
        {/* Red Series */}
        <div className="bg-[#131519] p-4 rounded-xl border border-stone-800 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-mono font-black uppercase tracking-wider text-rose-400 mb-2 border-b border-stone-800 pb-1 flex items-center justify-between">
              <span>SÉRIE VERMELHA</span>
              <span className="text-stone-500 font-normal">Eritrograma</span>
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Hemoglobina (Hb):</span>
                <span className={`font-bold ${hb < 12 ? 'text-rose-400' : 'text-stone-100'}`}>{hb} g/dL</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Hematócrito (Ht):</span>
                <span className="font-bold text-stone-100">{ht}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">VCM:</span>
                <span className={`font-bold ${vcm < 80 ? 'text-amber-400' : vcm > 100 ? 'text-sky-400' : 'text-stone-100'}`}>{vcm} fL</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">HCM / RDW:</span>
                <span className="font-bold text-stone-100">{hcm} pg / {rdw}%</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-stone-800/80 text-[11px] font-mono text-amber-300/90">
            {anemiaType}
          </div>
        </div>

        {/* White Series */}
        <div className="bg-[#131519] p-4 rounded-xl border border-stone-800 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-mono font-black uppercase tracking-wider text-sky-400 mb-2 border-b border-stone-800 pb-1 flex items-center justify-between">
              <span>SÉRIE BRANCA</span>
              <span className="text-stone-500 font-normal">Leucograma</span>
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Leucócitos Totais:</span>
                <span className={`font-bold ${leucocytes > 11000 ? 'text-rose-400' : leucocytes < 4000 ? 'text-amber-400' : 'text-stone-100'}`}>
                  {leucocytes.toLocaleString()} /mm³
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Bastões:</span>
                <span className={`font-bold ${bastoes > 5 ? 'text-rose-400' : 'text-stone-100'}`}>{bastoes}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Segmentados:</span>
                <span className="font-bold text-stone-100">{segs}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Linfócitos / Monó:</span>
                <span className="font-bold text-stone-100">{lymph}% / {mono}%</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-stone-800/80 text-[11px] font-mono text-sky-300/90">
            {leucoType}
          </div>
        </div>

        {/* Platelet Series */}
        <div className="bg-[#131519] p-4 rounded-xl border border-stone-800 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-400 mb-2 border-b border-stone-800 pb-1 flex items-center justify-between">
              <span>PLAQUETAS</span>
              <span className="text-stone-500 font-normal">Plaquetograma</span>
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Contagem Total:</span>
                <span className={`font-bold ${platelets < 150000 ? 'text-rose-400' : 'text-stone-100'}`}>
                  {platelets.toLocaleString()} /mm³
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Valor de Referência:</span>
                <span className="text-stone-400">150k - 450k /mm³</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-stone-800/80 text-[11px] font-mono text-amber-300/90">
            {plateletType}
          </div>
        </div>
      </div>

      {/* Preceptor Impression Footer */}
      <div className="p-4 bg-[#0a0c0e] font-mono text-xs text-stone-300 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
        <span>Sua interpretação clínica rápida: <strong className="text-stone-100">{rawText.split('\n')[0] || 'Hemograma analisado pelo Preceptor.'}</strong></span>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 3. CLINICAL LCR / LIQUOR ANALYSIS INTERPRETER                              */
/* ========================================================================== */
export const ClinicalLcrViewer = ({ text }: { text: string }) => {
  const rawText = text.trim();
  const lowerText = rawText.toLowerCase();

  const extractVal = (pattern: RegExp): number | null => {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const aspect = lowerText.includes('purulento') ? 'Purulento / Turvo' : lowerText.includes('xantocr') ? 'Xantocrômico (Hemático)' : lowerText.includes('turvo') ? 'Turvo / Opalescente' : 'Límpido e Incolor ("Água de Rocha")';
  const pressAbertura = extractVal(/(?:press[ãa]o|abertura)\s*[:=]?\s*(\d+)/i) ?? 15;
  const leucocytes = extractVal(/(?:leuc[óo]citos|c[ée]lulas)\s*[:=]?\s*(\d+)/i) ?? 4;
  const pmn = extractVal(/(?:pmn|polimorfonucleares|neutr[óo]filos)\s*[:=]?\s*(\d+)/i) ?? (lowerText.includes('pmn') ? 80 : 20);
  const protein = extractVal(/(?:prote[íi]na|proteinorrac)\s*[:=]?\s*(\d+)/i) ?? 30;
  const glucose = extractVal(/(?:glicose|glicorrac)\s*[:=]?\s*(\d+)/i) ?? 60;
  const glycemia = extractVal(/(?:glicemia)\s*[:=]?\s*(\d+)/i) ?? 100;

  const glycRatio = glucose / glycemia;

  let meningitePattern = 'Perfil Liquórico Normal';
  if (leucocytes > 1000 || pmn > 70) {
    meningitePattern = 'Padrão Sugestivo de Meningite Bacteriana Aguda (Pleocitose Neutrofílica + Hipoglicorraquia + Proteína Elevada)';
  } else if (leucocytes > 10 && pmn < 50) {
    if (glucose < 40 || glycRatio < 0.4) meningitePattern = 'Padrão Sugestivo de Meningite Tuberculosa ou Fúngica (Pleocitose Linfomonocitária com Hipoglicorraquia)';
    else meningitePattern = 'Padrão Sugestivo de Meningite Viral / Asséptica (Pleocitose Linfocitária com Glicorraquia Preservada)';
  } else if (aspect.includes('Xantocrômico')) {
    meningitePattern = 'Padrão Xantocrômico - Sugestivo de Hemorragia Subaracnóidea (HSA)';
  }

  return (
    <div className="my-6 rounded-2xl border border-stone-800 bg-[#0d0b12] text-stone-100 overflow-hidden shadow-2xl font-sans">
      <div className="bg-[#1a1424] px-4 py-3 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse shrink-0" />
          <div>
            <div className="text-xs font-mono font-black uppercase tracking-wider text-purple-400">
              ANÁLISE DE LÍQUIDO CEFALORRAQUIDIANO (LCR / LIQUOR)
            </div>
            <div className="text-[11px] font-mono text-stone-400">
              Punção Lombar • Perfil Citoquímico & Microbiológico de Meningites
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800 px-2.5 py-1 rounded-md">
          {meningitePattern.includes('Normal') ? 'LCR NORMAL' : 'ALTERAÇÃO LIQUÓRICA'}
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 border-b border-stone-800">
        {/* Left Tube Visual Aspect */}
        <div className="bg-[#14101d] p-4 rounded-xl border border-stone-800 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] font-mono uppercase font-black tracking-widest text-stone-400 mb-3">
            ASPECTO MACROSCÓPICO DO TUBO
          </div>
          <div className="w-12 h-28 rounded-b-full border-2 border-stone-700 p-1 flex items-end justify-center mb-2"
               style={{
                 background: aspect.includes('Purulento') ? 'linear-gradient(to top, #ca8a04, #fef08a)' : aspect.includes('Xantocr') ? 'linear-gradient(to top, #b45309, #fde047)' : 'linear-gradient(to top, #38bdf822, #ffffff11)'
               }}>
            <div className="w-full h-3/4 rounded-b-full bg-white/20 backdrop-blur-sm" />
          </div>
          <div className="text-sm font-mono font-bold text-purple-300 mt-1">{aspect}</div>
          <div className="text-[11px] font-mono text-stone-400">Pressão de Abertura: {pressAbertura} cmH₂O</div>
        </div>

        {/* Right Cyto-Chemical Metrics */}
        <div className="space-y-2.5 font-mono text-xs">
          <div className="bg-[#14101d] p-3 rounded-lg border border-stone-800 flex justify-between items-center">
            <span className="text-stone-400">Celularidade Total:</span>
            <span className={`font-bold ${leucocytes > 10 ? 'text-purple-400' : 'text-stone-100'}`}>{leucocytes} cels/mm³ (PMN: {pmn}%)</span>
          </div>
          <div className="bg-[#14101d] p-3 rounded-lg border border-stone-800 flex justify-between items-center">
            <span className="text-stone-400">Proteinorraquia:</span>
            <span className={`font-bold ${protein > 45 ? 'text-amber-400' : 'text-stone-100'}`}>{protein} mg/dL (Ref: 15-45)</span>
          </div>
          <div className="bg-[#14101d] p-3 rounded-lg border border-stone-800 flex justify-between items-center">
            <span className="text-stone-400">Glicorraquia / Glicemia:</span>
            <span className={`font-bold ${glycRatio < 0.5 ? 'text-rose-400' : 'text-stone-100'}`}>{glucose} mg/dL (Razão: {glycRatio.toFixed(2)})</span>
          </div>
          <div className="bg-purple-950/40 p-3 rounded-lg border border-purple-800/60 text-purple-200 font-bold text-[11px]">
            {meningitePattern}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 4. CLINICAL SPIROMETRY & PULMONARY FUNCTION INTERPRETER                    */
/* ========================================================================== */
export const ClinicalSpirometryViewer = ({ text }: { text: string }) => {
  const rawText = text.trim();
  const lowerText = rawText.toLowerCase();

  const extractVal = (pattern: RegExp): number | null => {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const vef1 = extractVal(/(?:vef1|fev1)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 65; // % prev
  const cvf = extractVal(/(?:cvf|fvc)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 85; // % prev
  const ratio = extractVal(/(?:vef1\/cvf|fev1\/fvc|tiffeneau)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? Math.round((vef1 / cvf) * 100);
  const fef2575 = extractVal(/(?:fef\s*25-?75|fef2575)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 52;
  const hasBdResponse = lowerText.includes('resposta') || lowerText.includes('positiva') || lowerText.includes('200ml') || lowerText.includes('12%') || lowerText.includes('broncodilatador');

  let pattern = 'Prova de Função Pulmonar Normal';
  let severityGrade = 'Sem limitação ventilatória';
  if (ratio < 70) {
    if (vef1 >= 80) severityGrade = 'Obstrução Leve (VEF₁ ≥ 80%)';
    else if (vef1 >= 50) severityGrade = 'Obstrução Moderada (VEF₁ 50 - 79%)';
    else if (vef1 >= 30) severityGrade = 'Obstrução Grave (VEF₁ 30 - 49%)';
    else severityGrade = 'Obstrução Muito Grave (VEF₁ < 30%)';

    pattern = hasBdResponse 
      ? `Distúrbio Ventilatório Obstrutivo com Resposta Significativa ao Broncodilatador (${severityGrade})` 
      : `Distúrbio Ventilatório Obstrutivo sem Resposta ao Broncodilatador (${severityGrade})`;
  } else if (cvf < 80) {
    pattern = 'Sugestivo de Distúrbio Ventilatório Restritivo (Requer Pletermografia / CPT para confirmação)';
  }

  return (
    <div className="my-6 rounded-2xl border border-stone-800 bg-[#070b0e] text-stone-100 overflow-hidden shadow-2xl font-sans">
      {/* Header */}
      <div className="bg-[#101820] px-4 py-3 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          <div>
            <div className="text-xs font-mono font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <span>ESPIROMETRIA & PROVA DE FUNÇÃO PULMONAR</span>
              {hasBdResponse && <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold">PROVA BD +</span>}
            </div>
            <div className="text-[11px] font-mono text-stone-400">
              Curva Fluxo-Volume • Espirograma Expiratório / Inspiratório
            </div>
          </div>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border ${
          ratio < 70 ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
        }`}>
          {ratio < 70 ? 'PADRÃO OBSTRUTIVO' : cvf < 80 ? 'PADRÃO RESTRITIVO' : 'ESPIROMETRIA NORMAL'}
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 border-b border-stone-800">
        {/* SVG Flow-Volume Loop Box */}
        <div className="lg:col-span-6 bg-[#0c1218] p-4 rounded-xl border border-stone-800 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between text-[10px] font-mono text-stone-400 font-bold uppercase mb-1">
            <span>CURVA FLUXO-VOLUME (L/s x Litros)</span>
            <span className="text-cyan-400 font-extrabold">ALTA FIDELIDADE</span>
          </div>

          <div className="w-full flex items-center justify-center my-2">
            <svg viewBox="0 0 320 220" className="w-full max-w-[300px] h-auto drop-shadow-md select-none">
              {/* Axes Grid Background */}
              <rect x="30" y="10" width="270" height="200" fill="#06090c" stroke="#1e293b" strokeWidth="1" />
              <line x1="30" y1="110" x2="300" y2="110" stroke="#334155" strokeWidth="2" /> {/* Baseline Flow = 0 */}
              <line x1="50" y1="10" x2="50" y2="210" stroke="#334155" strokeWidth="2" /> {/* Baseline Volume = 0 */}

              {/* Grid Horizontal Reference Lines */}
              <line x1="30" y1="35" x2="300" y2="35" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="30" y1="180" x2="300" y2="180" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />

              {/* Axis Labels */}
              <text x="35" y="25" fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">+10 L/s (PICO)</text>
              <text x="35" y="105" fill="#cbd5e1" fontSize="9" fontFamily="monospace" fontWeight="bold">0 L/s</text>
              <text x="35" y="200" fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">-5 L/s (INSP)</text>
              <text x="260" y="125" fill="#cbd5e1" fontSize="9" fontFamily="monospace" fontWeight="bold">VOL (L)</text>

              {/* 1. PREDICTED NORMAL LOOP (Dashed Green Stroke - ALWAYS VISIBLE!) */}
              <path
                d="M 50 110 C 65 25, 120 15, 270 110 C 200 180, 80 180, 50 110 Z"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />

              {/* 2. PATIENT MEASURED PRE-BD CURVE (Solid Cyan Line) */}
              {ratio < 70 ? (
                /* Obstructive Pattern Curve (Concave scoop in expiration) */
                <path
                  d="M 50 110 C 65 65, 100 85, 230 110 C 180 160, 80 160, 50 110 Z"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                />
              ) : cvf < 80 ? (
                /* Restrictive Pattern Curve (Narrow volume loop) */
                <path
                  d="M 50 110 C 60 30, 90 20, 160 110 C 130 160, 70 160, 50 110 Z"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                />
              ) : (
                /* Normal Curve (Tracking close to predicted) */
                <path
                  d="M 50 110 C 65 28, 118 18, 265 110 C 195 178, 80 178, 50 110 Z"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                />
              )}

              {/* 3. POST-BRONCHODILATOR OVERLAY CURVE (Amber Dashed) */}
              {hasBdResponse && ratio < 70 && (
                <path
                  d="M 50 110 C 65 45, 110 50, 250 110 C 190 170, 80 170, 50 110 Z"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                />
              )}
            </svg>
          </div>

          {/* Flow-Volume Curve Legend */}
          <div className="w-full flex flex-wrap items-center justify-around gap-2 font-mono text-[10px] bg-[#07090c] p-2 rounded-lg border border-stone-800">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400 border-b border-dashed border-emerald-400" />
              <span className="text-emerald-300 font-bold">--- Previsto (Normal)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-cyan-400 rounded-full" />
              <span className="text-cyan-300 font-bold">― Medido Pré-BD</span>
            </div>
            {hasBdResponse && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 border-b border-dashed border-amber-400" />
                <span className="text-amber-300 font-bold">--- Pós-BD (+12%)</span>
              </div>
            )}
          </div>
        </div>

        {/* Key Spirometric Metrics Grid */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-3 font-mono text-xs">
          <div className="bg-[#0c1218] p-3.5 rounded-xl border border-stone-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-stone-400 font-bold">Índice VEF₁/CVF (Tiffeneau):</span>
              <span className={`text-sm font-black ${ratio < 70 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {ratio}% <span className="text-xs font-normal text-stone-400">(LIN: 70%)</span>
              </span>
            </div>
            <div className="text-[10px] text-stone-400">
              {ratio < 70 ? '⚠️ Razão reduzida (< 70%) - Caracteriza limitação obstrutiva ao fluxo aéreo.' : '✓ Razão preservada (≥ 70%).'}
            </div>
          </div>

          <div className="bg-[#0c1218] p-3.5 rounded-xl border border-stone-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-stone-400 font-bold">VEF₁ (% do Previsto):</span>
              <span className={`text-sm font-black ${vef1 < 80 ? 'text-amber-400' : 'text-stone-100'}`}>
                {vef1}% <span className="text-xs font-normal text-stone-400">(Ref: ≥ 80%)</span>
              </span>
            </div>
            <div className="text-[10px] text-stone-400">
              Volume expiratório forçado no primeiro segundo. Define a gravidade do distúrbio.
            </div>
          </div>

          <div className="bg-[#0c1218] p-3.5 rounded-xl border border-stone-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-stone-400 font-bold">CVF (% do Previsto):</span>
              <span className={`text-sm font-black ${cvf < 80 ? 'text-amber-400' : 'text-stone-100'}`}>
                {cvf}% <span className="text-xs font-normal text-stone-400">(Ref: ≥ 80%)</span>
              </span>
            </div>
            <div className="text-[10px] text-stone-400">
              Capacidade vital forçada expirada do TLC ao RV.
            </div>
          </div>

          <div className="bg-[#0c1218] p-3.5 rounded-xl border border-stone-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-stone-400 font-bold">FEF 25-75% (% do Previsto):</span>
              <span className={`text-sm font-black ${fef2575 < 60 ? 'text-amber-400' : 'text-stone-100'}`}>
                {fef2575}% <span className="text-xs font-normal text-stone-400">(Ref: ≥ 65%)</span>
              </span>
            </div>
            <div className="text-[10px] text-stone-400">
              Fluxo expiratório forçado médio (Avaliação de pequenas vias aéreas).
            </div>
          </div>
        </div>
      </div>

      {/* Preceptor Diagnostic Conclusion */}
      <div className="p-4 bg-[#0a0f14] font-mono text-xs text-cyan-200 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
        <span><strong>Conclusão do Preceptor:</strong> {pattern}</span>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 5. CLINICAL URINALYSIS (EAS / URINA 1) INTERPRETER                        */
/* ========================================================================== */
export const ClinicalUrineViewer = ({ text }: { text: string }) => {
  const rawText = text.trim();
  const lowerText = rawText.toLowerCase();

  const extractVal = (pattern: RegExp): number | null => {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Physical parameters
  const cor = lowerText.includes('avermelhad') || lowerText.includes('hem[áa]tica') ? 'Avermelhada' : lowerText.includes('ambar') ? 'Amarelo Âmbar' : lowerText.includes('castanh') ? 'Castanho / Guaraná' : 'Amarelo Citrino';
  const aspecto = lowerText.includes('turvo') ? 'Turvo' : lowerText.includes('ligeiramente') ? 'Ligeiramente Turvo' : 'Límpido';
  const densidade = extractVal(/(?:densidade)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 1.020;
  const ph = extractVal(/(?:ph)\s*[:=]?\s*(\d+[.,]?\d*)/i) ?? 6.0;

  // Chemical parameters
  const leucos = extractVal(/(?:leuc[óo]citos|pi[óo]citos)\s*[:=]?\s*(\d+)/i) ?? (lowerText.includes('numeros') || lowerText.includes('piuria') ? 45 : 4);
  const hemacias = extractVal(/(?:hem[áa]cias|hem[áa]cia|eritrocitos)\s*[:=]?\s*(\d+)/i) ?? 2;
  const nitrito = lowerText.includes('nitrito positivo') || lowerText.includes('nitrito (+)') || lowerText.includes('nitrito pos') || lowerText.includes('nitrito: pos');
  const esterase = lowerText.includes('esterase positiva') || lowerText.includes('esterase (+)') || leucos > 10;
  const protein = lowerText.includes('prote[íi]na (+)') || lowerText.includes('proteina positiva') || lowerText.includes('3+') || lowerText.includes('4+') || lowerText.includes('proteinuria');

  // Microscopic / Sediment
  const bacterias = nitrito || leucos > 20 || lowerText.includes('bact[ée]rias abundantes') ? 'Abundante (+++)' : lowerText.includes('moderada') ? 'Moderada (++)' : 'Raras / Ausente';
  const cristais = lowerText.includes('oxalato') ? 'Oxalato de Cálcio' : lowerText.includes('[áa]cido [úu]rico') ? 'Ácido Úrico' : lowerText.includes('fosfato') ? 'Triplo Fosfato' : 'Ausentes';

  let urinePattern = 'Exame Sumário de Urina (EAS) dentro dos Padrões da Normalidade';
  if (nitrito || leucos > 10) {
    urinePattern = 'Quadro Típico de Infecção do Trato Urinário (ITU / Piúria Maciça & Bacteriúria) - Indicação de Urocultura com Antibiograma';
  } else if (protein) {
    urinePattern = 'Proteinúria Significativa - Requer investigação de Glomerulopatia / Síndrome Nefrótica ou Nefrítica';
  } else if (hemacias > 5) {
    urinePattern = 'Hematúria Significativa (> 5 hemácias/campo) - Investigar etiologia urológica (litíase, neoplasia) ou nefrológica';
  }

  return (
    <div className="my-6 rounded-2xl border border-stone-800 bg-[#12100a] text-stone-100 overflow-hidden shadow-2xl font-sans">
      {/* EAS Header */}
      <div className="bg-[#221c0e] px-4 py-3 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <div>
            <div className="text-xs font-mono font-black uppercase tracking-wider text-amber-400">
              SUMÁRIO DE URINA / EAS / SEDIMENTOSCOPIA (URINA 1)
            </div>
            <div className="text-[11px] font-mono text-stone-400">
              Análise Tríplice: Exame Físico (Macroscopia), Fita Reativa & Microscopia de Campo
            </div>
          </div>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border ${
          nitrito || leucos > 10 ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-amber-950 text-amber-300 border-amber-800'
        }`}>
          {nitrito || leucos > 10 ? 'ITU DETECTADA' : 'EAS LAUDADO'}
        </span>
      </div>

      {/* 3-Section Panel */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5 border-b border-stone-800 font-mono text-xs">
        {/* Panel 1: Exame Físico */}
        <div className="bg-[#18140c] p-4 rounded-xl border border-stone-800 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 mb-2 border-b border-stone-800 pb-1 flex justify-between">
              <span>I. EXAME FÍSICO</span>
              <span className="text-stone-500 font-normal">Macroscopia</span>
            </div>
            <div className="space-y-2 text-stone-300">
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Cor:</span>
                <span className="font-bold text-amber-300">{cor}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Aspecto:</span>
                <span className={`font-bold ${aspecto.includes('Turvo') ? 'text-amber-400' : 'text-stone-100'}`}>{aspecto}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Densidade:</span>
                <span className="font-bold text-stone-100">{densidade.toFixed(3)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">pH Urinário:</span>
                <span className="font-bold text-stone-100">{ph.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Test Tube Visual Graphic */}
          <div className="mt-3 pt-2 border-t border-stone-800 flex items-center justify-center gap-3">
            <div className="w-5 h-12 rounded-b-full border border-stone-600 p-0.5 flex items-end justify-center bg-stone-900 overflow-hidden">
              <div className="w-full h-3/4 rounded-b-full" style={{
                background: cor.includes('Avermelhad') ? '#b91c1c' : cor.includes('Castanh') ? '#78350f' : '#facc15'
              }} />
            </div>
            <span className="text-[10px] text-stone-400">Tubo Amostra Fresca</span>
          </div>
        </div>

        {/* Panel 2: Exame Químico (Fita Reativa) */}
        <div className="bg-[#18140c] p-4 rounded-xl border border-stone-800 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 mb-2 border-b border-stone-800 pb-1 flex justify-between">
              <span>II. EXAME QUÍMICO</span>
              <span className="text-stone-500 font-normal">Fita Reativa</span>
            </div>
            <div className="space-y-2 text-stone-300">
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Nitrito:</span>
                <span className={`font-bold ${nitrito ? 'text-rose-400' : 'text-stone-100'}`}>{nitrito ? 'POSITIVO (+)' : 'Negativo'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Esterase Leucocitária:</span>
                <span className={`font-bold ${esterase ? 'text-amber-400' : 'text-stone-100'}`}>{esterase ? 'POSITIVA (+)' : 'Negativa'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Proteínas:</span>
                <span className={`font-bold ${protein ? 'text-amber-400' : 'text-stone-100'}`}>{protein ? 'POSITIVA (+)' : 'Ausente'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Glicose / Cetonas:</span>
                <span className="font-bold text-stone-100">Ausentes</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-stone-800 text-[10px] text-stone-400">
            Fita reagente fotométrica padronizada
          </div>
        </div>

        {/* Panel 3: Sedimentoscopia */}
        <div className="bg-[#18140c] p-4 rounded-xl border border-stone-800 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 mb-2 border-b border-stone-800 pb-1 flex justify-between">
              <span>III. SEDIMENTOSCOPIA</span>
              <span className="text-stone-500 font-normal">Microscopia</span>
            </div>
            <div className="space-y-2 text-stone-300">
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Leucócitos / Piócitos:</span>
                <span className={`font-bold ${leucos > 10 ? 'text-rose-400' : 'text-stone-100'}`}>{leucos} / campo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Hemácias / Eritrócitos:</span>
                <span className={`font-bold ${hemacias > 5 ? 'text-rose-400' : 'text-stone-100'}`}>{hemacias} / campo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Flora Bacteriana:</span>
                <span className={`font-bold ${bacterias.includes('Abundante') ? 'text-rose-400' : 'text-stone-100'}`}>{bacterias}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400">Cristais:</span>
                <span className="font-bold text-stone-100">{cristais}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-stone-800 text-[10px] text-stone-400">
            Contagem em campo de grande aumento (400x)
          </div>
        </div>
      </div>

      {/* Preceptor Conclusion */}
      <div className="p-4 bg-[#0d0a06] font-mono text-xs text-amber-200 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span><strong>Conclusão do Preceptor:</strong> {urinePattern}</span>
      </div>
    </div>
  );
};

const renderMonospaceLineTokens = (
  line: string, 
  searchQuery: string, 
  theme: 'dark' | 'paper' | 'crt' | 'blueprint'
) => {
  if (!line) return '\n';

  // Strict uniform font-normal to prevent glyph width distortion
  const boxClass = theme === 'dark' 
    ? 'text-indigo-400 font-normal' 
    : theme === 'crt' 
    ? 'text-emerald-400 font-normal' 
    : theme === 'blueprint'
    ? 'text-cyan-300 font-normal'
    : 'text-indigo-600 font-normal';

  const arrowClass = theme === 'dark'
    ? 'text-emerald-400 font-normal'
    : theme === 'crt'
    ? 'text-yellow-300 font-normal'
    : theme === 'blueprint'
    ? 'text-emerald-300 font-normal'
    : 'text-emerald-600 font-normal';

  const noteClass = theme === 'dark'
    ? 'text-sky-300 font-normal'
    : theme === 'crt'
    ? 'text-emerald-200 font-normal'
    : theme === 'blueprint'
    ? 'text-cyan-200 font-normal'
    : 'text-indigo-900 font-normal';

  const mainClass = theme === 'dark'
    ? 'text-slate-100 font-normal'
    : theme === 'crt'
    ? 'text-emerald-300 font-normal'
    : theme === 'blueprint'
    ? 'text-white font-normal'
    : 'text-slate-900 font-normal';

  const medicalTermRegex = /(Metoprolol|Diltiazem|Verapamil|Carvedilol|Digoxina|Cardioversão|Anticoagulação|ETE|FA\/FLUTTER|ICFER|< 48 horas|> 48 horas|CONTROLE DE FREQUÊNCIA|CONTROLE DE RITMO)/i;
  const tokenRegex = /([┌┐└┘┬┴┼│─═├┤]+)|([▼▲◄►↓↑→]|-->|->)|(\([^)]+\))/g;

  const elements: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  const pushWithSearchAndMedical = (str: string, keyPrefix: string, baseClass: string) => {
    if (!str) return;

    const renderTextSegment = (textSeg: string, segKey: string) => {
      if (medicalTermRegex.test(textSeg)) {
        const medParts = textSeg.split(medicalTermRegex);
        return medParts.map((mPart, mIdx) => {
          if (medicalTermRegex.test(mPart)) {
            const isDrug = /Metoprolol|Diltiazem|Verapamil|Carvedilol|Digoxina/i.test(mPart);
            const isProc = /Cardioversão|Anticoagulação|ETE/i.test(mPart);
            const medColor = isDrug 
              ? (theme === 'paper' ? 'text-purple-700 font-normal' : 'text-purple-300 font-normal')
              : isProc
              ? (theme === 'paper' ? 'text-amber-700 font-normal' : 'text-amber-300 font-normal')
              : (theme === 'paper' ? 'text-indigo-800 font-normal' : 'text-cyan-300 font-normal');

            return (
              <span key={`${segKey}-m-${mIdx}`} className={medColor}>
                {mPart}
              </span>
            );
          }
          return <span key={`${segKey}-n-${mIdx}`} className={baseClass}>{mPart}</span>;
        });
      }
      return <span key={segKey} className={baseClass}>{textSeg}</span>;
    };

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = str.split(new RegExp(`(${escaped})`, 'gi'));
      parts.forEach((part, idx) => {
        if (part.toLowerCase() === q.toLowerCase()) {
          elements.push(
            <mark key={`${keyPrefix}-q-${idx}`} className="bg-amber-300 text-stone-950 font-normal px-0 select-text">
              {part}
            </mark>
          );
        } else if (part) {
          elements.push(renderTextSegment(part, `${keyPrefix}-p-${idx}`));
        }
      });
    } else {
      elements.push(renderTextSegment(str, keyPrefix));
    }
  };

  let count = 0;
  while ((match = tokenRegex.exec(line)) !== null) {
    const start = match.index;
    const matched = match[0];

    if (start > lastIdx) {
      pushWithSearchAndMedical(line.slice(lastIdx, start), `pre-${count}`, mainClass);
    }

    if (match[1]) {
      elements.push(
        <span key={`box-${count}`} className={boxClass}>
          {matched}
        </span>
      );
    } else if (match[2]) {
      elements.push(
        <span key={`arrow-${count}`} className={arrowClass}>
          {matched}
        </span>
      );
    } else if (match[3]) {
      pushWithSearchAndMedical(matched, `note-${count}`, noteClass);
    }

    lastIdx = tokenRegex.lastIndex;
    count++;
  }

  if (lastIdx < line.length) {
    pushWithSearchAndMedical(line.slice(lastIdx), `post-${count}`, mainClass);
  }

  return <>{elements}</>;
};

export const TreeBranchRenderer = ({ text }: { text: string }) => {
  const { rootTitle, rootNodes } = useMemo(() => parseClinicalTreeStructure(text), [text]);
  const [viewMode, setViewMode] = useState<'ascii' | 'visual'>('ascii');
  const [zoomScale, setZoomScale] = useState(1.0);
  const [fontSize, setFontSize] = useState(12);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'dark' | 'paper' | 'crt' | 'blueprint'>('dark');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rawLines = useMemo(() => {
    if (!text) return [];
    // Convert tabs to 4 spaces and replace box-drawing connectors with spaces to clean up traces
    const lines = text.trim().split('\n').map(l => l.replace(/\t/g, '    '));

    const processedLines: string[] = [];
    let prevLineWasEmpty = false;

    for (const l of lines) {
      // Replace all box-drawing characters (┌ ┐ └ ┘ ┬ ┴ ┼ │ ─ ═ ├ ┤) with spaces
      const cleaned = l.replace(/[┌┐└┘┬┴┼│─═├┤]/g, ' ');
      const isWhitespaceOnly = cleaned.trim().length === 0;

      if (isWhitespaceOnly) {
        if (!prevLineWasEmpty && processedLines.length > 0) {
          processedLines.push('');
          prevLineWasEmpty = true;
        }
      } else {
        processedLines.push(cleaned);
        prevLineWasEmpty = false;
      }
    }

    while (processedLines.length > 0 && processedLines[processedLines.length - 1] === '') {
      processedLines.pop();
    }

    return processedLines;
  }, [text]);

  const maxLineLength = useMemo(() => {
    return rawLines.reduce((max, l) => Math.max(max, l.length), 0);
  }, [rawLines]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoFit = () => {
    if (maxLineLength > 0) {
      const targetCharWidth = 720 / maxLineLength;
      const targetFont = Math.max(9, Math.min(13, Math.floor(targetCharWidth * 1.5)));
      setFontSize(targetFont);
      setZoomScale(1.0);
    }
  };

  const resetAll = () => {
    setZoomScale(1.0);
    setFontSize(12);
    setSearchQuery('');
    setTheme('dark');
    setShowLineNumbers(true);
  };

  const getThemeClasses = () => {
    if (theme === 'paper') {
      return {
        outer: 'bg-[#f8fafc] text-slate-900 border-2 border-slate-300 shadow-lg',
        header: 'bg-white border-b border-slate-200 text-slate-900',
        badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        canvas: 'bg-white border border-slate-200 shadow-inner',
        lineNumberText: 'text-slate-400 border-r border-slate-200',
        textColor: 'text-slate-900'
      };
    }
    if (theme === 'crt') {
      return {
        outer: 'bg-[#021812] text-emerald-300 border-2 border-emerald-900/80 shadow-2xl',
        header: 'bg-[#04291f] border-b border-emerald-900/80 text-emerald-100',
        badge: 'bg-emerald-950 text-emerald-300 border-emerald-700',
        canvas: 'bg-[#01110c] border border-emerald-950 shadow-inner',
        lineNumberText: 'text-emerald-700 border-r border-emerald-950',
        textColor: 'text-emerald-300'
      };
    }
    if (theme === 'blueprint') {
      return {
        outer: 'bg-[#0B192C] text-cyan-100 border-2 border-cyan-800/60 shadow-2xl',
        header: 'bg-[#1E3E62] border-b border-cyan-800/80 text-white',
        badge: 'bg-cyan-950 text-cyan-200 border-cyan-600/50',
        canvas: 'bg-[#061426] border border-cyan-900/60 shadow-inner',
        lineNumberText: 'text-cyan-600 border-r border-cyan-900/80',
        textColor: 'text-cyan-100'
      };
    }
    // Default dark
    return {
      outer: 'bg-[#0a0f1d] text-slate-100 border-2 border-indigo-950/80 shadow-xl',
      header: 'bg-[#131b2e] border-b border-indigo-900/60 text-white',
      badge: 'bg-indigo-950 text-indigo-200 border-indigo-700',
      canvas: 'bg-[#060a12] border border-indigo-950/80 shadow-inner',
      lineNumberText: 'text-slate-600 border-r border-indigo-950/80',
      textColor: 'text-slate-100'
    };
  };

  const themeStyle = getThemeClasses();

  const MONOSPACE_FONT_STACK = "'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', Courier, 'Liberation Mono', 'DejaVu Sans Mono', monospace";

  const renderMonospaceContent = () => (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#060a14] border border-slate-800/80 shadow-inner overflow-x-auto overflow-y-auto scrollbar-thin">
      <div 
        style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top left' }}
        className="transition-transform duration-200 w-max min-w-full select-text"
      >
        <div 
          className="flex leading-[1.3] font-normal select-text text-slate-100"
          style={{ 
            fontFamily: MONOSPACE_FONT_STACK, 
            fontSize: `${fontSize}px`, 
            letterSpacing: '0px', 
            wordSpacing: '0px',
            fontVariantNumeric: 'tabular-nums',
            fontVariantEastAsian: 'normal'
          }}
        >
          <pre className="whitespace-pre font-normal leading-[1.3] m-0 flex-1">
            {rawLines.map((line, lIdx) => (
              <div key={lIdx} className="leading-[1.3] hover:bg-white/5 transition-colors">
                {renderMonospaceLineTokens(line, searchQuery, theme)}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <div className="my-6 w-full min-w-0 font-sans">
      <div className="rounded-3xl overflow-hidden bg-[#0a0f1d] border-2 border-slate-800 shadow-xl">
        {/* High-Contrast Header Bar */}
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-slate-900 border-b border-slate-800 text-white">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <Terminal className="w-5 h-5 text-white" />
            </div>

            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 block">
                Algoritmo Decisório Clínico
              </span>
              <h4 className="text-sm sm:text-base font-bold text-white leading-snug mt-0.5 truncate">
                {rootTitle || 'Esquema de Conduta Hospitalar'}
              </h4>
            </div>
          </div>

          {/* Clean Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all"
              title="Expandir Tela Cheia"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
              title="Copiar Matriz ASCII"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <FileText className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Main Content: Clean ASCII Matrix */}
        <div className="p-4 sm:p-5">
          {renderMonospaceContent()}
        </div>
      </div>

      {/* Fullscreen Landscape Modal View */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex flex-col p-4 sm:p-6 text-white overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                <Terminal className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black uppercase tracking-wider truncate text-indigo-300">
                  {rootTitle || 'Algoritmo Decisório Clínico (ASCII)'}
                </h4>
                <p className="text-[11px] text-slate-300 font-mono">Modo Matriz Tela Cheia Monospaçado — Alinhamento de Caracteres Preservado</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/15 gap-1">
                <button
                  onClick={() => setZoomScale(p => Math.max(0.6, p - 0.1))}
                  className="p-1.5 rounded hover:bg-white/20 text-white font-bold"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-1">{Math.round(zoomScale * 100)}%</span>
                <button
                  onClick={() => setZoomScale(p => Math.min(2.0, p + 0.1))}
                  className="p-1.5 rounded hover:bg-white/20 text-white font-bold"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <FileText className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar Matriz'}</span>
              </button>

              <button
                onClick={() => setIsFullscreen(false)}
                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all flex items-center gap-1.5"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Fechar</span>
              </button>
            </div>
          </div>

          <div className={`flex-1 rounded-2xl ${themeStyle.canvas} p-4 sm:p-6 overflow-auto scrollbar-thin`}>
            {renderMonospaceContent()}
          </div>
        </div>
      )}
    </div>
  );
};

export const ClinicalFlowchartText = ({ text }: { text: string }) => {
  const normalizedText = normalizeTextForMarkdown(text);
  const lines = normalizedText.trim().split('\n');
  
  const isVerticalFlowchart = lines.some(l => {
    const trimmed = l.trim();
    return trimmed.includes('▼') || trimmed.includes('↓') || (trimmed.startsWith('[') && trimmed.includes(']')) || trimmed.includes('(Falha)') || trimmed.includes('(Sucesso)');
  });

  if (isVerticalFlowchart) {
    return <VerticalFlowchartRenderer text={normalizedText} />;
  }

  return (
    <div className="p-4 sm:p-6 text-[14.5px] leading-relaxed font-sans w-full text-stone-800 break-words overflow-x-auto">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkMath]} 
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={markdownComponents as any}
      >
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
};

export const markdownComponents: any = {
  pre: ({ children }: any) => {
    return <div className="my-5 w-full min-w-0 whitespace-normal break-words normal-case text-left">{children}</div>;
  },
  p: ({ children, ...props }: any) => {
    const text = getParagraphText(children);
    
    // Check if this paragraph is a clinical case vignette
    if (text.match(/^(caso clínico|caso clinico|vinheta|exemplo prático|exemplo pratico|quadro clínico típico|quadro clinico tipico):?/i)) {
      return (
        <div className="my-5 p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/5 border-l-4 border-amber-500 border-y border-r border-amber-200/80 rounded-r-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-amber-200/60">
            <span className="inline-flex items-center gap-1.5 bg-amber-100/90 text-amber-900 border border-amber-300 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              Caso Clínico / Vinheta Prática
            </span>
            <span className="text-[10px] font-mono text-amber-700/80 font-bold">Raciocínio de Plantão</span>
          </div>
          <div className="text-stone-800 text-sm sm:text-base leading-relaxed font-medium">
            {children}
          </div>
        </div>
      );
    }

    const hasBlockChild = React.Children.toArray(children).some((child: any) => {
      if (!child || typeof child !== 'object') return false;
      return (
        child.type === 'img' ||
        child.type === 'div' ||
        child.type === 'svg' ||
        child.type === MarkdownImage ||
        child.props?.src !== undefined ||
        child.props?.alt !== undefined ||
        (typeof child.type === 'string' && ['img', 'div', 'svg', 'hr', 'table', 'ol', 'ul', 'li'].includes(child.type))
      );
    });
    
    if (hasBlockChild) {
      return <div className="mb-4 last:mb-0 leading-relaxed text-stone-800" {...props}>{children}</div>;
    }
    return <p className="mb-4 text-stone-800 leading-relaxed" {...props}>{children}</p>;
  },

  img: ({ node, ...props }: any) => {
    return <MarkdownImage {...props} />;
  },

  svg: ({ node, ...props }: any) => {
    try {
      const rawSvgHtml = hastToHtml(node);
      return (
        <span 
          className="inline-block max-w-full overflow-x-auto my-4 scrollbar-thin"
          dangerouslySetInnerHTML={{ __html: rawSvgHtml }} 
        />
      );
    } catch (e) {
      console.error('Error rendering serialized SVG node', e);
      return <span className="text-red-500 text-xs">Erro ao renderizar SVG</span>;
    }
  },

  h1: ({ children, ...props }: any) => {
    const text = getParagraphText(children);
    const id = slugify(text);
    return (
      <div id={id} className="my-7 pb-3 border-b-2 border-[#D44E3D]">
        <h1 className="text-2xl sm:text-4xl font-display font-black tracking-tight text-[#1A1A1A] !my-0" {...props}>
          {children}
        </h1>
      </div>
    );
  },

  h2: ({ children, ...props }: any) => {
    const text = getParagraphText(children);
    const id = slugify(text);
    const style = getHeaderStyle(text);

    if (style) {
      const Icon = style.icon;
      return (
        <div id={id} className={`my-6 p-3.5 sm:p-4 rounded-xl border-y border-r border-stone-200/60 ${style.border} ${style.bg} shadow-2xs`}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${style.badgeBg} inline-flex items-center gap-1.5`}>
              <Icon className={`w-3.5 h-3.5 ${style.iconColor}`} />
              {style.badge}
            </span>
          </div>
          <h2 className={`text-xl sm:text-2xl font-display font-black tracking-tight ${style.text} !mt-1 !mb-0`} {...props}>
            {children}
          </h2>
        </div>
      );
    }

    return (
      <div id={id} className="my-6 pt-3 pb-2 border-b-2 border-[#D44E3D]/30 flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight text-[#1A1A1A] !my-0" {...props}>
          {children}
        </h2>
        <span className="w-2.5 h-2.5 rounded-full bg-[#D44E3D]" />
      </div>
    );
  },

  h3: ({ children, ...props }: any) => {
    const text = getParagraphText(children);
    const id = slugify(text);
    const style = getHeaderStyle(text);

    if (style) {
      const Icon = style.icon;
      return (
        <div id={id} className={`my-5 p-3 rounded-xl ${style.border} ${style.bg} border-y border-r border-stone-200/50`}>
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${style.iconColor} shrink-0`} />
            <h3 className={`text-base sm:text-lg font-display font-bold ${style.text} !my-0`} {...props}>
              {children}
            </h3>
          </div>
        </div>
      );
    }

    return (
      <h3 id={id} className="text-base sm:text-lg font-display font-bold text-stone-900 mt-5 mb-2 pl-3 border-l-3 border-[#D44E3D]" {...props}>
        {children}
      </h3>
    );
  },

  h4: ({ children, ...props }: any) => {
    const text = getParagraphText(children);
    const id = slugify(text);
    return (
      <h4 id={id} className="text-sm font-sans font-extrabold text-stone-800 mt-4 mb-2 uppercase tracking-wide flex items-center gap-2" {...props}>
        <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block shrink-0" />
        {children}
      </h4>
    );
  },

  blockquote: ({ children, ...props }: any) => {
    const text = getParagraphText(children);

    if (text.includes('📝 NOTA') || text.includes('NOTA:')) {
      return (
        <div className="my-5 p-4 bg-sky-50/90 border-l-4 border-sky-500 border-y border-r border-sky-200/80 rounded-r-2xl shadow-2xs text-sky-950 leading-relaxed text-sm sm:text-base font-medium">
          {children}
        </div>
      );
    }
    if (text.includes('💡 DICA') || text.includes('MACETE') || text.includes('DICA:')) {
      return (
        <div className="my-5 p-4 bg-emerald-50/90 border-l-4 border-emerald-500 border-y border-r border-emerald-200/80 rounded-r-2xl shadow-2xs text-emerald-950 leading-relaxed text-sm sm:text-base font-medium">
          {children}
        </div>
      );
    }
    if (text.includes('✨ IMPORTANTE') || text.includes('PONTO CHAVE') || text.includes('IMPORTANTE:')) {
      return (
        <div className="my-5 p-4 bg-amber-50/90 border-l-4 border-amber-500 border-y border-r border-amber-200/80 rounded-r-2xl shadow-2xs text-amber-950 leading-relaxed text-sm sm:text-base font-medium">
          {children}
        </div>
      );
    }
    if (text.includes('⚠️ ATENÇÃO') || text.includes('CUIDADO') || text.includes('PEGADINHA') || text.includes('ATENÇÃO:')) {
      return (
        <div className="my-5 p-4 bg-rose-50/90 border-l-4 border-rose-500 border-y border-r border-rose-200/80 rounded-r-2xl shadow-2xs text-rose-950 leading-relaxed text-sm sm:text-base font-medium">
          {children}
        </div>
      );
    }

    if (text.toLowerCase().includes('caso clínico') || text.toLowerCase().includes('caso clinico') || text.toLowerCase().includes('paciente')) {
      return (
        <div className="my-5 p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/5 border-l-4 border-amber-500 border-y border-r border-amber-200/80 rounded-r-2xl shadow-xs">
          <div className="flex items-center gap-2 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider mb-2">
            <Activity className="w-4 h-4 text-amber-600 shrink-0" />
            Caso Clínico Ilustrativo
          </div>
          <div className="text-stone-800 text-sm sm:text-base leading-relaxed font-medium">
            {children}
          </div>
        </div>
      );
    }

    return (
      <blockquote className="border-l-4 border-[#D44E3D] bg-[#FAF8F5] p-4 sm:p-5 my-5 rounded-r-xl border-y border-r border-[#E2E0D9]/80 text-[#2C2B29] shadow-2xs leading-relaxed italic text-sm sm:text-base" {...props}>
        {children}
      </blockquote>
    );
  },

  table: ({ children, ...props }: any) => (
    <div className="my-6 w-full min-w-0">
      <div className="block sm:hidden mb-2 text-right">
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-amber-200 shadow-2xs animate-pulse">
          Deslize para o lado para ver a tabela completa ↔
        </span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-stone-200/90 shadow-sm bg-white scrollbar-thin max-w-full">
        <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-full table-auto" {...props}>
          {children}
        </table>
      </div>
    </div>
  ),

  thead: ({ children, ...props }: any) => (
    <thead className="bg-[#FAF9F5] border-b border-stone-200 text-stone-900 font-bold tracking-tight" {...props}>
      {children}
    </thead>
  ),

  tbody: ({ children, ...props }: any) => (
    <tbody className="divide-y divide-stone-100 bg-white" {...props}>
      {children}
    </tbody>
  ),

  tr: ({ children, ...props }: any) => (
    <tr className="hover:bg-amber-50/30 transition-colors odd:bg-white even:bg-[#FAF9F5]/50" {...props}>
      {children}
    </tr>
  ),

  th: ({ children, ...props }: any) => (
    <th className="px-4 py-3 sm:px-5 sm:py-3.5 font-sans font-black uppercase tracking-wider text-[11px] text-stone-800 border-b border-stone-200 break-words min-w-[120px]" {...props}>
      {children}
    </th>
  ),

  td: ({ children, ...props }: any) => (
    <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-stone-800 font-medium leading-relaxed border-b border-stone-100 align-top break-words max-w-xs sm:max-w-md min-w-[140px]" {...props}>
      {children}
    </td>
  ),

  ul: ({ children, ...props }: any) => (
    <ul className="my-4 space-y-2 pl-5 text-stone-800 list-disc marker:text-[#D44E3D]" {...props}>
      {children}
    </ul>
  ),

  ol: ({ children, ...props }: any) => (
    <ol className="my-4 space-y-2 pl-5 text-stone-800 list-decimal marker:text-[#D44E3D] marker:font-black" {...props}>
      {children}
    </ol>
  ),

  li: ({ children, ...props }: any) => (
    <li className="leading-relaxed text-stone-800 text-sm sm:text-base pl-1" {...props}>
      {children}
    </li>
  ),

  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="bg-indigo-50/90 border border-indigo-200/80 text-indigo-900 font-mono text-[11.5px] px-1.5 py-0.5 rounded-md font-semibold" {...props}>
          {children}
        </code>
      );
    }

    const codeContent = String(children || '').trim();
    
    // 1. Graphviz DOT algorithms
    const isGraphviz = codeContent.includes('digraph') || codeContent.includes('graph {') || codeContent.includes('subgraph');
    if (isGraphviz) {
      return <ClinicalAlgorithm dotText={codeContent} />;
    }

    // 2. 2D ASCII Box Diagrams (has multi-column box drawing or branch junction characters)
    const isAsciiBoxDiagram = (
      /[┌┐└┘┬┴┼]/.test(codeContent) ||
      (codeContent.includes('├') && codeContent.includes('┤')) ||
      (codeContent.includes('│') && codeContent.includes('—') && codeContent.includes('▼')) ||
      (codeContent.includes('[') && codeContent.includes(']') && codeContent.includes('—') && codeContent.includes('│'))
    );
    if (isAsciiBoxDiagram) {
      return <ClinicalAsciiDiagramViewer text={codeContent} />;
    }

    // 3. Tree branch algorithms (ASCII tree flowcharts with ├ or └)
    const isTreeAlgorithm = (codeContent.includes('├') || codeContent.includes('└')) && !codeContent.includes('┌');
    if (isTreeAlgorithm) {
      return <ClinicalAsciiDiagramViewer text={codeContent} />;
    }

    // 4. Vertical Step Cascades (Step 1 \n ▼ \n Step 2 \n ▼ \n Step 3)
    const isVerticalCascade = (
      (codeContent.includes('▼') || codeContent.includes('↓')) &&
      !codeContent.includes('PREVENÇÃO') &&
      !codeContent.includes('CDI') &&
      !codeContent.includes('┌')
    );
    if (isVerticalCascade) {
      return <SequentialFlowRenderer text={codeContent} />;
    }

    // 5. Explicit vertical decision flowcharts (with [Box 1] -> [Box 2] + Falha/Sucesso)
    const isVerticalFlowchart = (codeContent.includes('[') && codeContent.includes(']') && (codeContent.includes('Falha') || codeContent.includes('Sucesso')));
    if (isVerticalFlowchart) {
      return <VerticalFlowchartRenderer text={codeContent} />;
    }

    // 6a. ECG Waveforms & Vector Drawings
    const isEcgWaveform = (
      codeContent.includes('\\_/') ||
      codeContent.includes('Pseudo r\'') ||
      codeContent.includes('Infradesnivelamento') ||
      codeContent.includes('Supradesnivelamento') ||
      /supra|infra|eletrocardiogram|ecg|onda p|qrs|segmento st|intervalo pr|qtc|derivação|derivacao|linha isoelétrica|linha isoeletrica/i.test(codeContent) ||
      (codeContent.includes('P') && codeContent.includes('QRS') && (codeContent.includes('T') || codeContent.includes('ST'))) ||
      (className && String(className).toLowerCase().includes('ecg'))
    ) && !codeContent.includes('Instabilidade');
    if (isEcgWaveform) {
      return <ClinicalEcgViewer text={codeContent} />;
    }

    // 6b. Spirometry & Pulmonary Function Test (BEFORE Radiology so it takes priority!)
    const isSpirometry = (
      /espirometria|vef1|fev1|cvf|fvc|tiffeneau|broncodilatador|prova de fun[çc][ãa]o pulmonar/i.test(codeContent) ||
      (className && /espirometria|spirometry/i.test(String(className)))
    ) && (codeContent.includes('VEF1') || codeContent.includes('VEF₁') || codeContent.includes('CVF') || codeContent.includes('Tiffeneau') || /espirometria|broncodilatador/i.test(codeContent));

    if (isSpirometry) {
      return <ClinicalSpirometryViewer text={codeContent} />;
    }

    // 6c. Urinalysis / EAS / Urina 1
    const isUrine = (
      /sum[áa]rio de urina|eas|urina|sedimentoscopia|leucocit[úu]ria|pi[úu]ria|nitrito|esterase|pi[óo]citos|densidade|urol[óo]gic|fita reativa/i.test(codeContent) ||
      (className && /eas|urina|urinalysis|urine/i.test(String(className)))
    ) && (
      codeContent.includes('Leucócitos') || 
      codeContent.includes('Piócitos') || 
      codeContent.includes('Hemácias') || 
      codeContent.includes('Nitrito') || 
      codeContent.includes('EAS') ||
      codeContent.includes('Urina') ||
      codeContent.includes('Densidade') ||
      codeContent.includes('Sedimentoscopia')
    );

    if (isUrine) {
      return <ClinicalUrineViewer text={codeContent} />;
    }

    // 6d. Arterial Gasometry & Acid-Base Balance
    const isGasometry = (
      /gasometria|gaso|pco2|hco3|pao2|fio2|base excess|davenport|dist[úu]rbio acidob[áa]sico|acidose|alcalose/i.test(codeContent) ||
      (className && /gaso|gasometria|acidbase/i.test(String(className)))
    ) && (
      codeContent.includes('pCO2') || 
      codeContent.includes('PCO2') || 
      codeContent.includes('HCO3') || 
      codeContent.includes('PaO2') || 
      /gasometria|gaso/i.test(codeContent)
    );

    if (isGasometry) {
      return <ClinicalGasometryViewer text={codeContent} />;
    }

    // 6e. Complete Hemogram & Differential Leukocytes
    const isHemogram = (
      /hemograma|hem[áa]cias|hemoglobina|hemat[óo]crito|vcm|hcm|rdw|leuc[óo]citos|bastoes|bast[õo]es|segmentados|linf[óo]citos|plaquetas/i.test(codeContent) ||
      (className && /hemogram|hemo|leucogram/i.test(String(className)))
    ) && (codeContent.includes('Hb') || codeContent.includes('Hemoglobina') || codeContent.includes('Leucócitos') || codeContent.includes('Plaquetas'));

    if (isHemogram) {
      return <ClinicalHemogramViewer text={codeContent} />;
    }

    // 6f. LCR / Liquor Analysis & Meningitis
    const isLcr = (
      /liquor|lcr|l[íi]quido cefalorraquidian|proteinorrac|glicorrac|pleocitose|pun[çc][ãa]o lombar|xantocr/i.test(codeContent) ||
      (className && /lcr|liquor/i.test(String(className)))
    ) && (codeContent.includes('Células') || codeContent.includes('Proteína') || codeContent.includes('Glicose') || codeContent.includes('LCR'));

    if (isLcr) {
      return <ClinicalLcrViewer text={codeContent} />;
    }

    // 6g. Radiology & Imaging Reports (Raio-X, TC, RM, Ultrassom, Ecocardiograma)
    const isRadiologyReport = (
      /raio-?x|rx|tomografia|tc|resson[aâ]ncia|rm|radiolog|laudo|pacs|ultrassom|usg|ecocardiogram|incid[êe]ncia|par[êe]nquima|mediastino|costofr[êe]nico|pleura|opacidade|condensa[çc][ãa]o|pneumot[óo]rax|derrame|infiltrado/i.test(codeContent) ||
      (className && /rx|raio-?x|laudo|tc|radiology|imaging|radiografia/i.test(String(className)))
    ) && (
      codeContent.includes(':') || codeContent.includes('Achados') || codeContent.includes('Laudo') || codeContent.includes('Conclusão') || codeContent.includes('Impressão') || codeContent.includes('Tórax') || codeContent.includes('TÓRAX') || codeContent.includes('Lobo')
    ) && !isSpirometry && !isUrine && !isGasometry && !isHemogram && !isLcr;

    if (isRadiologyReport) {
      return <ClinicalRadiologyViewer text={codeContent} />;
    }

    // 7. Horizontal step flows (Step 1 ➔ Step 2)
    const isHorizontalFlowchart = codeContent.includes('➔') || codeContent.includes('->') || codeContent.includes('⇒');
    if (isHorizontalFlowchart) {
      const steps = codeContent.split(/(?:➔|->|⇒)/).map(s => s.trim()).filter(Boolean);
      return (
        <div className="my-6 p-6 bg-gradient-to-r from-amber-50/85 to-orange-50/45 border border-amber-200 rounded-2xl shadow-sm">
          <div className="text-[10px] uppercase font-black tracking-wider text-amber-800 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            Cascata de Eventos Clínicos
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {steps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="bg-white border border-amber-200/80 text-stone-900 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2.5">
                  <span className="text-[10px] text-amber-700 font-mono bg-amber-50 w-5 h-5 rounded-full flex items-center justify-center border border-amber-100 font-black shrink-0">
                    {idx + 1}
                  </span>
                  <span className="tracking-tight">{step}</span>
                </div>
                {idx < steps.length - 1 && (
                  <span className="text-amber-500 font-bold text-base select-none">➔</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    }

    // 8. Standard code block
    return (
      <div className="my-4 bg-stone-900 text-stone-100 p-4 rounded-xl border border-stone-800 font-mono text-xs overflow-x-auto shadow-md">
        <pre className="m-0 font-mono whitespace-pre">{codeContent}</pre>
      </div>
    );
  },

  hr: () => (
    <hr className="my-8 border-t-2 border-dashed border-stone-200" />
  ),

  a: ({ children, href, ...props }: any) => {
    if (href && href.startsWith('#')) {
      const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        const id = slugify(href.substring(1));
        const element = document.getElementById(id) || document.getElementById(href.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          console.warn(`[Markdown link] Element with ID not found: ${id} or ${href.substring(1)}`);
        }
      };
      return <a href={href} onClick={handleClick} className="text-[#D44E3D] hover:underline font-semibold" {...props}>{children}</a>;
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#D44E3D] hover:underline font-semibold" {...props}>{children}</a>;
  }
};

export function convertMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // 1. Standardize line endings
  html = html.replace(/\r\n/g, '\n');

  // 2. Unescape AI-escaped markdown links e.g. \[text\](#anchor) or \[text\]\(#anchor\)
  html = html
    .replace(/\\\[([^\]\n]+)\\\]\\?\(([^)\n]+)\\?\)/g, '[$1]($2)')
    .replace(/\[([^\]\n]+)\]\\\(([^)\n]+)\\\)/g, '[$1]($2)')
    .replace(/\\\[([^\]\n]+)\\\]/g, '[$1]');

  // 3. Clean up double-encoded or stray HTML entities so they aren't double-escaped or rendered as raw text
  html = html
    .replace(/&amp;gt;/g, '>')
    .replace(/&amp;lt;/g, '<')
    .replace(/&amp;amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<');

  // 4. Extract all existing HTML tags (like <span class="..."> or </span> or <svg> or <br />)
  // so we don't escape or alter them
  const htmlTags: string[] = [];
  html = html.replace(/<[^>]+>/g, (match) => {
    const placeholder = `===HTMLTAGPLACEHOLDER${htmlTags.length}===`;
    htmlTags.push(match);
    return placeholder;
  });

  // 5. Escape remaining raw & that is NOT part of an existing entity
  html = html.replace(/&(?!([a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');

  // 6. Process Code Blocks
  const codeBlocks: string[] = [];
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const placeholder = `<!--CODEBLOCK_${codeBlocks.length}-->`;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return placeholder;
  });

  // 7. Process Inline Code
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`\n]+)`/g, (match, code) => {
    const placeholder = `<!--INLINECODE_${inlineCodes.length}-->`;
    inlineCodes.push(`<code>${code}</code>`);
    return placeholder;
  });

  // 8. Parse Custom Alerts & Blockquotes
  const alertTypes = [
    { key: 'NOTE', label: '📝 NOTA', className: 'note', badgeClass: 'badge-note' },
    { key: 'TIP', label: '💡 DICA / MACETE', className: 'tip', badgeClass: 'badge-tip' },
    { key: 'IMPORTANT', label: '✨ IMPORTANTE', className: 'important', badgeClass: 'badge-important' },
    { key: 'CAUTION', label: '⚠️ ATENÇÃO / CUIDADO', className: 'caution', badgeClass: 'badge-caution' },
    { key: 'WARNING', label: '⚠️ ATENÇÃO / CUIDADO', className: 'caution', badgeClass: 'badge-caution' },
    { key: 'CLINICAL_CASE', label: '🩺 CASO CLÍNICO PRÁTICO', className: 'clinical_case', badgeClass: 'badge-clinical_case' },
    { key: 'CHECKLIST', label: '📋 CONDUTA DE BEIRA DE LEITO', className: 'checklist', badgeClass: 'badge-checklist' },
    { key: 'SUMMARY', label: '📌 QUADRO DE DESTAQUE', className: 'summary', badgeClass: 'badge-summary' },
    { key: 'FLOWCHART', label: '🔄 ALGORITMO & FLUXOGRAMA', className: 'flowchart', badgeClass: 'badge-flowchart' }
  ];

  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inBlockquote = false;
  let blockquoteContent: string[] = [];
  let blockquoteType: typeof alertTypes[0] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('> ')) {
      let contentLine = line.substring(2);
      
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteContent = [];
        blockquoteType = null;
        
        for (const alert of alertTypes) {
          const pattern = new RegExp(`^\\[!${alert.key}\\]`, 'i');
          if (pattern.test(contentLine)) {
            blockquoteType = alert;
            contentLine = contentLine.replace(pattern, '').trim();
            break;
          }
        }
      } else if (blockquoteType === null) {
        for (const alert of alertTypes) {
          const pattern = new RegExp(`^\\[!${alert.key}\\]`, 'i');
          if (pattern.test(contentLine)) {
            blockquoteType = alert;
            contentLine = contentLine.replace(pattern, '').trim();
            break;
          }
        }
      }
      
      blockquoteContent.push(contentLine);
    } else {
      if (inBlockquote) {
        const innerHtml = convertMarkdownToHtml(blockquoteContent.join('\n'));
        if (blockquoteType) {
          processedLines.push(`<blockquote class="${blockquoteType.className}"><span class="badge ${blockquoteType.badgeClass}">${blockquoteType.label}</span>${innerHtml}</blockquote>`);
        } else {
          processedLines.push(`<blockquote>${innerHtml}</blockquote>`);
        }
        inBlockquote = false;
      }
      processedLines.push(line);
    }
  }
  if (inBlockquote) {
    const innerHtml = convertMarkdownToHtml(blockquoteContent.join('\n'));
    if (blockquoteType) {
      processedLines.push(`<blockquote class="${blockquoteType.className}"><span class="badge ${blockquoteType.badgeClass}">${blockquoteType.label}</span>${innerHtml}</blockquote>`);
    } else {
      processedLines.push(`<blockquote>${innerHtml}</blockquote>`);
    }
  }

  html = processedLines.join('\n');

  // 9. Tables Parsing
  const tableLines = html.split('\n');
  const tableProcessedLines: string[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const parts = line.split('|').map(p => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      if (!inTable) {
        inTable = true;
        tableHeaders = parts;
        tableRows = [];
      } else {
        const isSeparator = parts.every(p => /^:?-+:?$/.test(p));
        if (isSeparator) {
          continue;
        } else {
          tableRows.push(parts);
        }
      }
    } else {
      if (inTable) {
        let tableHtml = '<table><thead><tr>';
        tableHeaders.forEach(h => {
          tableHtml += `<th>${convertMarkdownToHtml(h)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        tableRows.forEach(row => {
          tableHtml += '<tr>';
          row.forEach(cell => {
            tableHtml += `<td>${convertMarkdownToHtml(cell)}</td>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        tableProcessedLines.push(tableHtml);
        inTable = false;
      }
      tableProcessedLines.push(tableLines[i]);
    }
  }
  if (inTable) {
    let tableHtml = '<table><thead><tr>';
    tableHeaders.forEach(h => {
      tableHtml += `<th>${convertMarkdownToHtml(h)}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    tableRows.forEach(row => {
      tableHtml += '<tr>';
      row.forEach(cell => {
        tableHtml += `<td>${convertMarkdownToHtml(cell)}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    tableProcessedLines.push(tableHtml);
  }

  html = tableProcessedLines.join('\n');

  // 10. Headings with slugified IDs
  html = html.replace(/^####\s+(.*)$/gm, (_, title) => {
    const cleanTitle = title.replace(/<[^>]+>/g, '').trim();
    const id = slugify(cleanTitle);
    return `<h4 id="${id}">${title}</h4>`;
  });
  html = html.replace(/^###\s+(.*)$/gm, (_, title) => {
    const cleanTitle = title.replace(/<[^>]+>/g, '').trim();
    const id = slugify(cleanTitle);
    return `<h3 id="${id}">${title}</h3>`;
  });
  html = html.replace(/^##\s+(.*)$/gm, (_, title) => {
    const cleanTitle = title.replace(/<[^>]+>/g, '').trim();
    const id = slugify(cleanTitle);
    return `<h2 id="${id}">${title}</h2>`;
  });
  html = html.replace(/^#\s+(.*)$/gm, (_, title) => {
    const cleanTitle = title.replace(/<[^>]+>/g, '').trim();
    const id = slugify(cleanTitle);
    return `<h1 id="${id}">${title}</h1>`;
  });

  // 11. Links parsing [text](url)
  html = html.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (match, text, url) => {
    const cleanUrl = url.trim();
    if (cleanUrl.startsWith('#')) {
      const targetId = slugify(cleanUrl.substring(1));
      return `<a href="#${targetId}" class="text-[#D44E3D] hover:underline font-semibold">${text}</a>`;
    }
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-[#D44E3D] hover:underline font-semibold">${text}</a>`;
  });

  // 12. Unordered Lists
  const listLines = html.split('\n');
  const listProcessedLines: string[] = [];
  let inList = false;

  for (let i = 0; i < listLines.length; i++) {
    const line = listLines[i];
    const match = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (match) {
      if (!inList) {
        listProcessedLines.push('<ul>');
        inList = true;
      }
      listProcessedLines.push(`<li>${match[2]}</li>`);
    } else {
      if (inList) {
        listProcessedLines.push('</ul>');
        inList = false;
      }
      listProcessedLines.push(line);
    }
  }
  if (inList) {
    listProcessedLines.push('</ul>');
  }
  html = listProcessedLines.join('\n');

  // 13. Ordered Lists
  const oListLines = html.split('\n');
  const oListProcessedLines: string[] = [];
  let inOList = false;

  for (let i = 0; i < oListLines.length; i++) {
    const line = oListLines[i];
    const match = line.match(/^\d+\.\s+(.*)$/);
    if (match) {
      if (!inOList) {
        oListProcessedLines.push('<ol>');
        inOList = true;
      }
      oListProcessedLines.push(`<li>${match[1]}</li>`);
    } else {
      if (inOList) {
        oListProcessedLines.push('</ol>');
        inOList = false;
      }
      oListProcessedLines.push(line);
    }
  }
  if (inOList) {
    oListProcessedLines.push('</ol>');
  }
  html = oListProcessedLines.join('\n');

  // 14. Horizontal Rules
  html = html.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 32px 0;" />');

  // 15. Bold, Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 16. Paragraph tags wrapping for non-empty lines that aren't block elements
  const blockElements = ['h1', 'h2', 'h3', 'h4', 'blockquote', 'table', 'ul', 'ol', 'pre', 'hr', 'div'];
  const finalLines = html.split('\n');
  const finalProcessedLines: string[] = [];

  for (let i = 0; i < finalLines.length; i++) {
    const line = finalLines[i].trim();
    if (!line) continue;

    const isBlock = blockElements.some(tag => line.startsWith(`<${tag}`) || line.endsWith(`</${tag}>`)) || 
                    line.startsWith('<!--') || 
                    line.startsWith('<hr');
    
    if (isBlock) {
      finalProcessedLines.push(line);
    } else {
      finalProcessedLines.push(`<p>${line}</p>`);
    }
  }
  html = finalProcessedLines.join('\n');

  // 17. Restore inline codes and code blocks
  inlineCodes.forEach((code, idx) => {
    html = html.replace(`<!--INLINECODE_${idx}-->`, code);
  });
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`<!--CODEBLOCK_${idx}-->`, block);
  });

  // 18. Restore HTML tags
  htmlTags.forEach((tag, idx) => {
    html = html.replaceAll(`===HTMLTAGPLACEHOLDER${idx}===`, () => tag);
  });

  return html;
}


