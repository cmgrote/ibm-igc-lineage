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

/**
 * @file Retrieves all RIDs from IGC (for stage columns) where the database column has then label "Needs Custom Lineage"
 * @license Apache-2.0
 * @requires ibm-igc-rest
 * @requires yargs
 * @example
 * // creates a file columnRIDs.json
 * ./getLineageCustomisationRIDs.js -f columnRIDs.json -d hostname:9445 -u isadmin -p isadmin
 */

const fs = require('fs-extra');
const pd = require('pretty-data').pd;
var igcrest = require('ibm-igc-rest');

// Command-line setup
var yargs = require('yargs');
var argv = yargs
    .usage('Usage: $0 -f <path> -d <host>:<port> -u <user> -p <password>')
    .option('f', {
      alias: 'file',
      describe: 'Output file into which to persist RIDs',
      demand: true, requiresArg: true, type: 'string'
    })
    .env('DS')
    .option('d', {
      alias: 'domain',
      describe: 'Host and port for invoking IGC REST',
      demand: true, requiresArg: true, type: 'string'
    })
    .option('u', {
      alias: 'deployment-user',
      describe: 'User for invoking IGC REST',
      demand: true, requiresArg: true, type: 'string'
    })
    .option('p', {
      alias: 'deployment-user-password',
      describe: 'Password for invoking IGC REST',
      demand: true, requiresArg: true, type: 'string'
    })
    .help('h')
    .alias('h', 'help')
    .wrap(yargs.terminalWidth())
    .argv;

// Base settings
var outputFile = argv.file;
var host_port = argv.domain.split(":");
igcrest.setAuth(argv.deploymentUser, argv.deploymentUserPassword);
igcrest.setServer(host_port[0], host_port[1]);

var customLineageColsQ = {
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
}

var lineageCols = {};

igcrest.search(customLineageColsQ, function (err, resSearch) {
  
  for (var i = 0; i < resSearch.items.length; i++) {
    
    var dbCol = resSearch.items[i];
    var dbColName = dbCol._name;
    console.log("Found column: " + dbColName);
    
    if (dbCol.hasOwnProperty("read_by_(design)")) {
      for (var j = 0; j < dbCol["read_by_(design)"].items.length; j++) {
        var stgColRead = dbCol["read_by_(design)"].items[j];
        var stgRID = stgColRead._id;
        console.log("... read by: " + stgRID);
        lineageCols[stgRID] = {};
        lineageCols[stgRID].name = stgColRead._name;
        lineageCols[stgRID].mode = "READ";
        lineageCols[stgRID].dbcol = dbColName;
        lineageCols[stgRID].dbrid = dbCol._id;
      }
    }
    
    if (dbCol.hasOwnProperty("written_by_(design)")) {
      for (var j = 0; j < dbCol["written_by_(design)"].items.length; j++) {
        var stgColWritten = dbCol["written_by_(design)"].items[j];
        var stgRID = stgColWritten._id;
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

function outputRIDs(bMinify) {

  var output = "";
  if (bMinify) {
    output = pd.jsonmin(JSON.stringify(lineageCols));
  } else {
    output = pd.json(JSON.stringify(lineageCols));
  }

  var options = {
    "encoding": 'utf8',
    "mode": 0o644,
    "flag": 'w'
  }
  fs.writeFileSync(outputFile, output, options);

}
