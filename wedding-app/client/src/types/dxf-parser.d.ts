declare module 'dxf-parser' {
  export default class DxfParser { parseSync(source: string): { entities?: any[]; header?: any }; }
}
