export const ACCESS_GATE = 'ACCESS_GATE' as const;
/**
 * Ensures that o student tem plan active for acessar o painel.
 * Implementado pelo contexto de billing (subscription); exposto aqui for o
 * contexto de courses consumir via DIP.
 */
export interface AccessGate {
  garantirAccessStudent(userId: string): Promise<void>;
}
