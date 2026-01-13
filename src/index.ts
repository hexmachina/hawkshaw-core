#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("hawkshaw")
  .description("A sample CLI built with Node.js + TypeScript")
  .version("1.0.0");

// Parse CLI arguments
program.parse(process.argv);
