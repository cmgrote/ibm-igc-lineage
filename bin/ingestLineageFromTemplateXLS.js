#!/usr/bin/env node

/***
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

/**
 * @file Ingest the lineage described in the provided Excel file.
 * @license Apache-2.0
 * @requires ibm-igc-lineage
 * @requires ibm-iis-commons
 * @requires ibm-igc-rest
 * @requires prompt
 * @requires yargs
 * @example
 * // ingests all lineage flows descripted in the file Example.xlsx into the server the script is running against
 * ./ingestLineageFromTempalteXLS.js -f Example.xlsx
 */

const lineage = require('ibm-igc-lineage');
const commons = require('ibm-iis-commons');
const igcrest = require('ibm-igc-rest');
const prompt = require('prompt');
prompt.colors = false;

// Command-line setup
const yargs = require('yargs');
const argv = yargs
    .usage('Usage: $0 -f <file> -o <path> -a <authfile> -p <password>')
    .option('f', {
      alias: 'file',
      describe: 'Path to Excel file containing lineage flows',
      demand: true, requiresArg: true, type: 'string'
    })
    .option('o', {
      alias: 'output',
      describe: 'XML output file',
      demand: false, requiresArg: true, type: 'string'
    })
    .option('a', {
      alias: 'authfile',
      describe: 'Authorisation file containing environment context',
      requiresArg: true, type: 'string'
    })
    .option('p', {
      alias: 'password',
      describe: 'Password for invoking REST API',
      demand: false, requiresArg: true, type: 'string'
    })
    .help('h')
    .alias('h', 'help')
    .wrap(yargs.terminalWidth())
    .argv;

// Base settings
const inputFile = argv.file;
const outputFile = argv.output;

const bOutput = (outputFile !== undefined && outputFile !== "");

const envCtx = new commons.EnvironmentContext(null, argv.authfile);
if (bOutput) {
  argv.password = "unused";
}

prompt.override = argv;

const inputPrompt = {
  properties: {
    password: {
      hidden: true,
      required: true,
      message: "Please enter the password for user '" + envCtx.username + "': "
    }
  }
};
prompt.message = "";
prompt.delimiter = "";

prompt.start();
prompt.get(inputPrompt, function (errPrompt, result) {
  igcrest.setConnection(envCtx.getRestConnection(result.password));

  lineage.loadManuallyDefinedFlows(envCtx, inputFile, outputFile, function(err, results) {
    if (err !== null) {
      console.error(err);
    } else {
      console.log(results);
    }
  });

});
