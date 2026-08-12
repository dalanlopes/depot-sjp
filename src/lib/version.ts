// Fonte única da versão exibida no sistema (tela de login). Vem direto do
// package.json — para lançar uma nova versão, basta atualizar o "version"
// lá (e, se fizer sentido, registrar a mudança em CHANGELOG.md).
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
