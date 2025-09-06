// Override definition supaya tidak error di Angular browser
declare module '@solana/web3.js' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Agent {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Agent$1 {}
}
