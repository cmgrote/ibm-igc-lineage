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
 * @file Retrieves all RIDs from IGC (for stage columns) where the database column has then label "Needs Custom Lineage"
 * @license Apache-2.0
 * @requires ibm-igc-rest
 * @requires fs-extra
 * @requires pretty-data
 * @requires prompt
 * @requires yargs
 * @example
 * // creates a file columnRIDs.json
 * ./getLineageCustomisationRIDs.js -f columnRIDs.json -p isadmin
 */

const fs = require('fs-extra');
const pd = require('pretty-data').pd;
const igcrest = require('ibm-igc-rest');
const commons = require('ibm-iis-commons');
const prompt = require('prompt');
prompt.colors = false;

// Command-line setup
const yargs = require('yargs');
const argv = yargs
    .usage('Usage: $0 -f <path> -a <authfile> -p <password>')
    .option('f', {
      alias: 'file',
      describe: 'Output file into which to persist RIDs',
      demand: true, requiresArg: true, type: 'string'
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
const outputFile = argv.file;

const customLineageColsQ = {
  "pageSize": "10000",
  "properties": ["name", "read_by_(design)", "written_by_(design)"],
  "types": ["database_column"],
  "where":
  {
    "operator": "and",
    "conditions": [
      {
        "property": "labels.name",
        "operator": "=",
        "value": "Needs Custom Lineage"
      }
    ]
  }
};

const lineageCols = {};

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
  igcrest.search(customLineageColsQ, function (err, resSearch) {
    
    for (let i = 0; i < resSearch.items.length; i++) {
      
      const dbCol = resSearch.items[i];
      const dbColName = dbCol._name;
      console.log("Found column: " + dbColName);
      
      if (dbCol.hasOwnProperty("read_by_(design)")) {
        for (let j = 0; j < dbCol["read_by_(design)"].items.length; j++) {
          const stgColRead = dbCol["read_by_(design)"].items[j];
          const stgRID = stgColRead._id;
          console.log("... read by: " + stgRID);
          lineageCols[stgRID] = {};
          lineageCols[stgRID].name = stgColRead._name;
          lineageCols[stgRID].mode = "READ";
          lineageCols[stgRID].dbcol = dbColName;
          lineageCols[stgRID].dbrid = dbCol._id;
        }
      }
      
      if (dbCol.hasOwnProperty("written_by_(design)")) {
        for (let j = 0; j < dbCol["written_by_(design)"].items.length; j++) {
          const stgColWritten = dbCol["written_by_(design)"].items[j];
          const stgRID = stgColWritten._id;
          console.log("... written by: " + stgRID);
          lineageCols[stgRID] = {};
          lineageCols[stgRID].name = stgColWritten._name;
          lineageCols[stgRID].mode = "WRITTEN";
          lineageCols[stgRID].dbcol = dbColName;
          lineageCols[stgRID].dbrid = dbCol._id;
        }
      }
  
    }
  
    outputRIDs(false);
  
  });
});

function outputRIDs(bMinify) {

  let output = "";
  if (bMinify) {
    output = pd.jsonmin(JSON.stringify(lineageCols));
  } else {
    output = pd.json(JSON.stringify(lineageCols));
  }

  const options = {
    "encoding": 'utf8',
    "mode": 0o644,
    "flag": 'w'
  };
  fs.writeFileSync(outputFile, output, options);

}
