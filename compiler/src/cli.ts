#!/usr/bin/env node

import { existsSync } from 'fs';
import { join } from 'path';
import { parseArguments } from './args/arg_parser';
import { Compiler } from './compiling/compiler';
import { processCompilerConfig } from './config/config';

const args = parseArguments(process.argv.slice(2));

if (!args.map.p && !args.map.project) {
    const path = join(process.cwd(), 'heconfig.json');
    if (existsSync(path)) {
        args.map.p = 'heconfig.json';
    }
}

const compilerConfig = processCompilerConfig(args);
const compiler = new Compiler(process.cwd(), compilerConfig);
compiler.validate();
compiler.emit();
