import { join } from "path";
import { Output } from "../../config/config";
import { Emitter, EmitterInput, ParsedFile } from "../emitter";
import { emitPackageJson } from "./js_shared/emit_packagejson";

export class JsServerEmitter extends Emitter {
  private input: EmitterInput;
  private resolveImport: (src: string, path: string) => ParsedFile;

  public emitModule(
    input: EmitterInput,
    resolveImport: (src: string, path: string) => ParsedFile
  ): Output[] {
    this.input = input;
    this.resolveImport = resolveImport;

    const jsOutput: Output = {
      fileContent: "",
      filePath: join(input.outDir, input.emitConfig.namespace + ".js"),
    };

    const dtsOutput: Output = {
      fileContent: "",
      filePath: join(input.outDir, input.emitConfig.namespace + ".d.ts"),
    };

    jsOutput.fileContent = this.emitJs(input);
    dtsOutput.fileContent = this.emitDts(input);

    return [jsOutput, dtsOutput, emitPackageJson(input)];
  }

  private emitJs(input: EmitterInput): string {}
  private emitDts(input: EmitterInput): string {}
}
