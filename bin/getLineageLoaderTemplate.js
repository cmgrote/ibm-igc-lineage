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
 * @file Builds an Excel workbook where each sheet contains the required and optional parameters for an individaul IMAM bridge (required parameters in red)
 * @license Apache-2.0
 * @requires ibm-iis-commons
 * @requires ibm-igc-rest
 * @requires ibm-igc-lineage
 * @requires prompt
 * @requires yargs
 * @example
 * // gets an Excel workbook containing a template for ingesting manually-defined lineage flows
 * ./getLineageLoaderTemplate.js -f LineageTemplate.xlsx
 */

const commons = require('ibm-iis-commons');
const lineage = require('ibm-igc-lineage');
const igcrest = require('ibm-igc-rest');
const prompt = require('prompt');
prompt.colors = false;

// Command-line setup
const yargs = require('yargs');
const argv = yargs
    .usage('Usage: $0 -f <file> -a <authfile> -p <password>')
    .option('f', {
      alias: 'file',
      describe: 'Path to output file to produce',
      demand: true, requiresArg: true, type: 'string',
      default: 'LineageTemplate.xlsx'
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

const envCtx = new commons.EnvironmentContext(null, argv.authfile);

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

  const wb = new lineage.LineageWorkbook();
  wb.populateWithExistingAssets(igcrest, function(err) {
    if (err !== null) {
      console.log("ERROR: " + err);
    } else {
      wb.addValidationsToLineageSheet();
      wb.writeTemplate(argv.file);
    }
  });

});
