export const eduSubjectsByGrade: Record<number, string[]> = {
  1: ["Alifbe", "Ona tili", "O‘qish", "Matematika", "Atrofimizdagi olam", "Ingliz tili", "Rus tili", "Nemis tili", "Fransuz tili", "Tarbiya", "Odobnoma", "Tasviriy san’at", "Musiqa", "Texnologiya", "Jismoniy tarbiya"],
  2: ["Ona tili", "O‘qish", "Matematika", "Atrofimizdagi olam", "Ingliz tili", "Rus tili", "Nemis tili", "Fransuz tili", "Tarbiya", "Odobnoma", "Tasviriy san’at", "Musiqa", "Texnologiya", "Jismoniy tarbiya"],
  3: ["Ona tili", "O‘qish", "Matematika", "Tabiatshunoslik", "Ingliz tili", "Rus tili", "Nemis tili", "Fransuz tili", "Tarbiya", "Tasviriy san’at", "Musiqa", "Texnologiya", "Jismoniy tarbiya"],
  4: ["Ona tili", "O‘qish", "Matematika", "Tabiatshunoslik", "Ingliz tili", "Rus tili", "Nemis tili", "Fransuz tili", "Tarbiya", "Tasviriy san’at", "Musiqa", "Texnologiya", "Jismoniy tarbiya"],
  5: ["Ona tili", "Matematika", "Ingliz tili", "Adabiyot", "Biologiya", "Tarixdan hikoyalar", "Geografiya", "Informatika va AT", "Rus tili", "Fransuz tili", "Nemis tili", "O‘zbek tili", "Tabiiy fanlar", "Jismoniy tarbiya", "Musiqa", "Tasviriy san’at", "Texnologiya", "Tarbiya", "Vatan tuyg‘usi"],
  6: ["Ona tili", "Matematika", "Ingliz tili", "Adabiyot", "Fizika", "Tarix", "Geografiya", "Informatika va AT", "Rus tili", "Fransuz tili", "Nemis tili", "O‘zbek tili", "Botanika", "Tabiiy fanlar", "Jismoniy tarbiya", "Musiqa", "Tasviriy san’at", "Texnologiya", "Vatan tuyg‘usi"],
  7: ["Ona tili", "Algebra", "Geometriya", "Ingliz tili", "Adabiyot", "Fizika", "Kimyo", "Biologiya", "Jahon tarixi", "O‘zbekiston tarixi", "Geografiya", "Informatika va AT", "Rus tili", "Fransuz tili", "Nemis tili", "Jismoniy tarbiya", "Musiqa", "Tasviriy san’at", "Texnologiya", "Tarbiya", "Milliy istiqlol g‘oyasi"],
  8: ["Ona tili", "Algebra", "Geometriya", "Ingliz tili", "Adabiyot", "Fizika", "Kimyo", "Biologiya", "Jahon tarixi", "O‘zbekiston tarixi", "Geografiya", "Informatika va AT", "Rus tili", "Fransuz tili", "Nemis tili", "Jismoniy tarbiya", "Musiqa", "Tasviriy san’at", "Texnologiya", "Chizmachilik", "Tarbiya", "O‘zbekiston davlati va huquqi asoslari"],
  9: ["Ona tili", "Algebra", "Geometriya", "Ingliz tili", "Adabiyot", "Fizika", "Kimyo", "Biologiya", "Jahon tarixi", "O‘zbekiston tarixi", "Jahon ijtimoiy-iqtisodiy geografiyasi", "Informatika", "Rus tili", "Fransuz tili", "Nemis tili", "Iqtisodiy bilim asoslari", "Konstitutsiyaviy huquq asoslari", "Chizmachilik", "Texnologiya", "Milliy istiqlol g‘oyasi"],
  10: ["Ona tili", "Matematika", "Ingliz tili", "Adabiyot", "Fizika", "Organik kimyo", "Biologiya", "Jahon tarixi", "O‘zbekiston tarixi", "Geografiya", "Informatika", "Rus tili", "Fransuz tili", "Davlat va huquq", "Dunyo dinlari tarixi", "Ma’naviyat asoslari", "Chaqiruvga qadar boshlang‘ich tayyorgarlik"],
  11: ["Ona tili", "Matematika", "Ingliz tili", "Adabiyot", "Fizika", "Umumiy kimyo", "Biologiya", "Astronomiya", "Jahon tarixi", "O‘zbekiston tarixi", "Informatika", "Rus tili", "Fransuz tili", "Nemis tili", "Davlat va huquq asoslari", "Dunyo dinlari tarixi", "Ma’naviyat asoslari", "Tadbirkorlik asoslari", "Chaqiruvga qadar boshlang‘ich tayyorgarlik"],
};

export function getEduSubjects(grade: number): string[] {
  return eduSubjectsByGrade[grade] ?? eduSubjectsByGrade[7];
}
