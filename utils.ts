import { RawStudentRow, Student, Course, Network, CourseResult, ProcessingSummary } from './types';
import Papa from 'papaparse';

type GradeResult = { value: number; warning?: string };

// Parsing Helper with Validation
const parseGrade = (val: string): GradeResult => {
  if (!val) return { value: 0 };
  
  const clean = val.replace(/"/g, '').replace(',', '.').trim();
  let num = parseFloat(clean);
  
  if (isNaN(num)) return { value: 0 };

  if (num > 10) {
    if (num <= 100) {
      return { value: num / 10, warning: `Nota ${num} ajustada para ${num / 10}` };
    }
    return { value: 0, warning: `Nota ${num} ignorada (>100)` };
  }

  return { value: num };
};

const parseDate = (dateStr: string): Date => {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date();
};

const normalizeText = (str: string): string => {
  return str
    ? str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
    : "";
};

const normalizeKey = (value: string): string => {
  return normalizeText(value).replace(/[^A-Z0-9]/g, '');
};

const findColumnKey = (row: RawStudentRow, targets: string[]): string | undefined => {
  const normalizedTargets = targets.map(normalizeKey);
  return Object.keys(row).find((key) => normalizedTargets.includes(normalizeKey(key)));
};

const getValue = (row: RawStudentRow, targets: string[], fallback = ""): string => {
  const key = findColumnKey(row, targets);
  return key ? row[key] : fallback;
};

const resolveCourse = (raw: string): Course => {
  const normalized = normalizeText(raw);
  const match = (Object.values(Course) as string[]).find(
    (course) => normalizeText(course) === normalized
  );
  return (match as Course) ?? (raw as Course);
};

const SUBJECTS = [
  "PORTUGUÊS",
  "MATEMÁTICA",
  "HISTÓRIA",
  "GEOGRAFIA",
  "CIÊNCIAS",
  "ARTE",
  "ENSINO RELIGIOSO",
  "INGLÊS",
  "EDUCAÇÃO FÍSICA"
];

const getGradeValue = (row: RawStudentRow, subject: string, suffix: string): GradeResult => {
  const gradeStr = getValue(row, [`${subject} - ${suffix}`]);
  return parseGrade(gradeStr);
};

export const processCSV = (csvText: string): ProcessingSummary => {
  const result = Papa.parse<RawStudentRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  // Filtra linhas vazias ou sem dados essenciais (nome/inscrição)
  const validRows = result.data.filter((row) => {
    const nameRaw = getValue(row, ["NOME COMPLETO"]);
    const regRaw = getValue(row, ["NÚMERO DE INSCRIÇÃO", "NUMERO DE INSCRICAO"]);
    return Boolean((nameRaw && nameRaw.trim()) || (regRaw && regRaw.trim()));
  });

  const students: Student[] = validRows.map((row, index) => {
    const warnings: string[] = [];

    const registrationRaw = getValue(row, ["NÚMERO DE INSCRIÇÃO", "NUMERO DE INSCRICAO"]);
    const cleanedRegistration = registrationRaw ? registrationRaw.toString().replace(/"/g, '').trim() : "";
    const registrationNumber = cleanedRegistration || String(index + 1);
    if (!cleanedRegistration) {
      warnings.push('Número de inscrição ausente; gerado automaticamente.');
    }

    const nameRaw = getValue(row, ["NOME COMPLETO"]);
    const courseRaw = getValue(row, ["OPÇÃO DE CURSO", "OPCAO DE CURSO", "OPÇAO DE CURSO"]);
    const course = resolveCourse(courseRaw);

    const schoolRaw = normalizeText(getValue(row, ["ESCOLA DE ORIGEM"]));
    const network = schoolRaw.includes("PRIVADA") ? Network.PRIVATE : Network.PUBLIC;
    
    const neighborhoodRaw = getValue(row, ["BAIRRO"]);
    const neighborhoodNormalized = normalizeText(neighborhoodRaw);
    const isLocal = neighborhoodNormalized.includes("CENTRO"); 

    const quotaRaw = getValue(row, ["COTA DE ESCOLHA"]);
    const quotaNormalized = normalizeText(quotaRaw);
    const isPCD = quotaNormalized.includes("DEFICIENCIA") || quotaNormalized.includes("PCD");

    // 2. Grade Calculation
    let sum6 = 0, sum7 = 0, sum8 = 0;
    let sumPort = 0;
    let sumMat = 0;

    SUBJECTS.forEach(sub => {
      const r6 = getGradeValue(row, sub, "6º ANO");
      const r7 = getGradeValue(row, sub, "7º ANO");
      const r8 = getGradeValue(row, sub, "8º ANO");
      
      if (r6.warning) warnings.push(`${sub} 6º: ${r6.warning}`);
      if (r7.warning) warnings.push(`${sub} 7º: ${r7.warning}`);
      if (r8.warning) warnings.push(`${sub} 8º: ${r8.warning}`);

      sum6 += r6.value;
      sum7 += r7.value;
      sum8 += r8.value;

      if (sub === "PORTUGUÊS") sumPort += (r6.value + r7.value + r8.value);
      if (sub === "MATEMÁTICA") sumMat += (r6.value + r7.value + r8.value);
    });

    // 9th Grade is Bimesters 1, 2, 3
    let sum9 = 0;
    SUBJECTS.forEach(sub => {
      const b1 = getGradeValue(row, sub, "1º BIMESTRE");
      const b2 = getGradeValue(row, sub, "2º BIMESTRE");
      const b3 = getGradeValue(row, sub, "3º BIMESTRE");
      
      if (b1.warning) warnings.push(`${sub} 9º-B1: ${b1.warning}`);
      if (b2.warning) warnings.push(`${sub} 9º-B2: ${b2.warning}`);
      if (b3.warning) warnings.push(`${sub} 9º-B3: ${b3.warning}`);

      const avgSub9 = (b1.value + b2.value + b3.value) / 3;
      sum9 += avgSub9;

      if (sub === "PORTUGUÊS") sumPort += avgSub9;
      if (sub === "MATEMÁTICA") sumMat += avgSub9;
    });

    const avg6th = SUBJECTS.length ? sum6 / SUBJECTS.length : 0;
    const avg7th = SUBJECTS.length ? sum7 / SUBJECTS.length : 0;
    const avg8th = SUBJECTS.length ? sum8 / SUBJECTS.length : 0;
    const avg9th = SUBJECTS.length ? sum9 / SUBJECTS.length : 0;

    const finalScore = (avg6th + avg7th + avg8th + avg9th) / 4;
    const avgPort = sumPort / 4;
    const avgMat = sumMat / 4;

    return {
      id: `${index}-${nameRaw}`,
      registrationNumber,
      timestamp: getValue(row, ["Carimbo de data/hora"]),
      name: nameRaw.toUpperCase(),
      birthDate: parseDate(getValue(row, ["DATA DE NASCIMENTO"])),
      course,
      municipality: getValue(row, ["MUNICÍPIO", "MUNICIPIO"]),
      neighborhood: neighborhoodRaw,
      schoolNetwork: network,
      claimedQuota: quotaRaw,
      isPCD,
      isLocal,
      avg6th,
      avg7th,
      avg8th,
      avg9th,
      avgPort,
      avgMat,
      finalScore,
      warnings,
      rank: 0 
    };
  });

  // Organize by Course
  const results: CourseResult[] = Object.values(Course).map(course => {
    return processCourse(course, students.filter(s => s.course === course));
  });

  return {
    totalProcessed: students.length,
    results
  };
};

const processCourse = (course: Course, candidates: Student[]): CourseResult => {
  const sorted = [...candidates].sort((a, b) => {
    if (Math.abs(b.finalScore - a.finalScore) > 0.0001) return b.finalScore - a.finalScore;
    if (a.birthDate.getTime() !== b.birthDate.getTime()) {
      return a.birthDate.getTime() - b.birthDate.getTime(); 
    }
    if (Math.abs(b.avgPort - a.avgPort) > 0.0001) return b.avgPort - a.avgPort;
    return b.avgMat - a.avgMat;
  });

  // Capacidades do Anexo I (turmas de 45 vagas)
  const PCD_SLOTS = 2;
  const PUBLIC_TOTAL = 34;
  const PUBLIC_LOCAL = 10; // 30% da pública
  const PRIVATE_TOTAL = 9;
  const PRIVATE_LOCAL = 3; // 30% da privada

  const selectedPCD: Student[] = [];
  const selectedPubLocal: Student[] = [];
  const selectedPubBroad: Student[] = [];
  const selectedPrivLocal: Student[] = [];
  const selectedPrivBroad: Student[] = [];
  
  const selectedIds = new Set<string>();

  const addToSelected = (list: Student[], student: Student, category: string) => {
    student.status = 'SELECTED';
    student.selectedCategory = category;
    student.rank = list.length + 1;
    list.push(student);
    selectedIds.add(student.id);
  };

  // Fase 1: PCD (5% do total). Sobras vão para rede pública (item 3.3).
  const pcdEligible = sorted.filter(s => s.isPCD);
  for (const s of pcdEligible) {
    if (selectedPCD.length < PCD_SLOTS) {
      addToSelected(selectedPCD, s, 'PCD');
    }
  }
  const leftoverPCD = Math.max(PCD_SLOTS - selectedPCD.length, 0);

  // Fase 2: Rede privada (20%). Local primeiro, depois ampla. Sobras locais migram para ampla da mesma rede.
  const privLocalEligible = sorted.filter(s => 
    !selectedIds.has(s.id) && 
    s.schoolNetwork === Network.PRIVATE && 
    s.isLocal
  );
  
  for (const s of privLocalEligible) {
    if (selectedPrivLocal.length < PRIVATE_LOCAL) {
      addToSelected(selectedPrivLocal, s, 'PRIVADA - REGIÃO');
    }
  }
  const privateBroadCapacity = Math.max(PRIVATE_TOTAL - selectedPrivLocal.length, 0);

  const privBroadEligible = sorted.filter(s => 
    !selectedIds.has(s.id) && 
    s.schoolNetwork === Network.PRIVATE
  );

  for (const s of privBroadEligible) {
    if (selectedPrivBroad.length < privateBroadCapacity) {
      addToSelected(selectedPrivBroad, s, 'PRIVADA - AMPLA');
    }
  }
  // Sobras da rede privada (quando faltam candidatos) migrarão para pública ampla
  const leftoverPrivTotal = Math.max(PRIVATE_TOTAL - (selectedPrivLocal.length + selectedPrivBroad.length), 0);

  // Fase 3: Rede pública (80%) + eventuais sobras de PCD. Local primeiro, depois ampla.
  const pubLocalEligible = sorted.filter(s => 
    !selectedIds.has(s.id) && 
    s.schoolNetwork === Network.PUBLIC && 
    s.isLocal
  );

  for (const s of pubLocalEligible) {
    if (selectedPubLocal.length < PUBLIC_LOCAL) {
      addToSelected(selectedPubLocal, s, 'PÚBLICA - REGIÃO');
    }
  }
  const leftoverPubLocal = Math.max(PUBLIC_LOCAL - selectedPubLocal.length, 0);
  const publicBroadBase = PUBLIC_TOTAL - PUBLIC_LOCAL;
  const publicBroadCapacity = publicBroadBase + leftoverPubLocal + leftoverPCD + leftoverPrivTotal;
  
  const pubBroadEligible = sorted.filter(s => 
    !selectedIds.has(s.id) && 
    s.schoolNetwork === Network.PUBLIC
  );

  for (const s of pubBroadEligible) {
    if (selectedPubBroad.length < publicBroadCapacity) {
      let origin = 'PÚBLICA - AMPLA';
      
      if (selectedPubBroad.length >= publicBroadBase) {
        origin = 'PÚBLICA - AMPLA (REMANEJO)';
      }
      
      addToSelected(selectedPubBroad, s, origin);
    }
  }

  // Fase 4: Classificáveis (listas de espera)
  const waitingPCD: Student[] = [];
  const waitingPublicLocal: Student[] = [];
  const waitingPublicBroad: Student[] = [];
  const waitingPrivateLocal: Student[] = [];
  const waitingPrivateBroad: Student[] = [];

  const unselected = sorted.filter(s => !selectedIds.has(s.id));

  unselected.forEach(student => {
    student.status = 'WAITING';
    
    if (student.isPCD) {
      student.rank = waitingPCD.length + 1;
      waitingPCD.push(student);
    } else if (student.schoolNetwork === Network.PUBLIC) {
      if (student.isLocal) {
        student.rank = waitingPublicLocal.length + 1;
        waitingPublicLocal.push(student);
      } else {
        student.rank = waitingPublicBroad.length + 1;
        waitingPublicBroad.push(student);
      }
    } else if (student.schoolNetwork === Network.PRIVATE) {
      if (student.isLocal) {
        student.rank = waitingPrivateLocal.length + 1;
        waitingPrivateLocal.push(student);
      } else {
        student.rank = waitingPrivateBroad.length + 1;
        waitingPrivateBroad.push(student);
      }
    }
  });

  return {
    course,
    pcd: selectedPCD,
    publicLocal: selectedPubLocal,
    publicBroad: selectedPubBroad,
    privateLocal: selectedPrivLocal,
    privateBroad: selectedPrivBroad,
    
    waitingPCD,
    waitingPublicLocal,
    waitingPublicBroad,
    waitingPrivateLocal,
    waitingPrivateBroad
  };
};
