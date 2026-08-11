// SONDA NEGATIVA do gate de pureza.
// Este arquivo vive FORA de src/composicao/ de proposito: ele existe para
// provar que o varredor de pureza sabe reprovar. Se o gate parar de acusar
// as quatro violacoes daqui, o gate esta cego — e um gate cego sai verde.
export function impuro(): number {
  const agora = Date.now();
  const sorte = Math.random();
  setTimeout(() => undefined, 0);
  void fetch("https://exemplo.invalido/");
  return agora + sorte;
}
