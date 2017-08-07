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
 * @file Example automation of lineage customisation for jobs that either normalise or de-normalise column-level data, and where the ultimate source / target column name are the same
 * @license Apache-2.0
 * @requires ibm-iis-commons
 * @requires ibm-igc-rest
 * @requires ibm-igc-lineage
 * @requires fs-extra
 * @requires pretty-data
 * @requires yargs
 * @requires prompt
 * @param f {string} - XML file for which to customise lineage
 * @example
 * // creates customised lineage flow XML into /data/semanticLineage/mappedFlows/output/prjName__jobName.xml and re-detects lineage for the job
 * ./createColumnLevelPivots.js -f /data/semanticLineage/originalFlows/prjName__jobName.xml -r columnRIDs.json
 * @see getLineageCustomisationRIDs.js
 */

const fs = require('fs-extra');
const pd = require('pretty-data').pd;
const commons = require('ibm-iis-commons');
const igcrest = require('ibm-igc-rest');
const igclineage = require('ibm-igc-lineage');
const prompt = require('prompt');
prompt.colors = false;

// Command-line setup
const yargs = require('yargs');
const argv = yargs
    .usage('Usage: $0 -f <path> -r <path> -a <authfile> -p <password>')
    .option('f', {
      alias: 'file',
      describe: 'XML file for which to customise lineage',
      demand: true, requiresArg: true, type: 'string'
    })
    .option('r', {
      alias: 'rids',
      describe: 'JSON file of column RIDs that need custom lineage',
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
const inputFile = argv.file;
const mapFile = argv.rids;

// To keep generated IDs unique and retrievable
let id_gen = 0;
let ds_rid_gen = 0;
const hmObjectIdentitiesToIds = {};
let bHasBeenCustomised = false;

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

  const pivotColumns = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  
  // Read input XML
  const xmldata = fs.readFileSync(inputFile, 'utf8');
  const fh = new igclineage.FlowHandler();
  fh.parseXML(xmldata.toString());
  
  // ... get basic information from XML
  const eProj = fh.getProjectNode();
  const eJob = fh.getJobNode();
  console.log("Customising lineage for: " + fh.getAssetName(eProj) + ", " + fh.getAssetName(eJob) + " (" + fh.getAssetRID(eJob) + ")");
  
  const eEntryFlows = fh.getEntryFlows();
  const eExitFlows = fh.getExitFlows();
  const eSystemFlows = fh.getSystemFlows();
  
  // Kick-off the automated customisation...
  const innerFlows = fh.getSubflows(eSystemFlows);
  for (let i = 0; i < innerFlows.length; i++) {
    const eInnerFlow = innerFlows[i];
    const sSources = eInnerFlow.getAttribute("sourceIDs");
    const sTargets = eInnerFlow.getAttribute("targetIDs");
    resolveSourceToTargetMappings(fh, pivotColumns, eEntryFlows, eExitFlows, eSystemFlows, sSources, sTargets);
  }
  
  if (bHasBeenCustomised) {
    // Output the results
    const sFlowFilename = getFlowFilename(fh, eProj, eJob);
    outputCustomXML(fh, sFlowFilename);
    copyOriginalToMapped(sFlowFilename);
    igcrest.detectLineageForJob(fh.getAssetRID(eJob), function(err, resLineage) {
      console.log("... lineage re-detection status: " + resLineage.message);
    });
  } else {
    console.log("... no customisation needed, default lineage retained.");
  }

});

// Most of the work: the 'sources' and 'targets' are the DataStage column-based ones (system flows)
// - for each of the source IDs, determine what data store (column) feeds that DS-column
// - for each of the target IDs, determine what data store (column) is written by that DS-column
// - check each column (read or written) for whether it matches one marked as a pivot
// - if so, handle it accordingly (add a new conditional column and re-map the flows to this new column)
function resolveSourceToTargetMappings(fh, pivotColumns, entryFlows, exitFlows, systemFlows, sources, targets) {
  
  let bSourceIsPivot = false;
  let bTargetIsPivot = false;

  const aTargetIDs = targets.split(" ");
  const aSourceIDs = sources.split(" ");

  for (let i = 0; i < aSourceIDs.length; i++) {
    const sSourceId = aSourceIDs[i];
    const eSourceDS = fh.getAssetById(sSourceId);
    const sSourceColId = fh.getRepositoryIdFromDSSourceId(entryFlows, sSourceId);
    if (typeof sSourceColId === 'undefined' || sSourceColId === null) {
      console.warn("WARN: column for source not found!  (XML id: " + sSourceId + ")");
    } else {
      
      const eSource = fh.getAssetById(sSourceColId);
      const sSourceColName = fh.getAssetName(eSource);
      bSourceIsPivot = (pivotColumns.hasOwnProperty(fh.getAssetRID(eSourceDS)));
      
      for (let j = 0; j < aTargetIDs.length; j++) {
        const sTargetId = aTargetIDs[j];
        const eTargetDS = fh.getAssetById(sTargetId);
        const sTargetColId = fh.getRepositoryIdFromDSTargetId(exitFlows, sTargetId);
        let sTargetColName = "";
        let eTarget = null;
        if (typeof sTargetColId === 'undefined' || sTargetColId === null) {
          console.warn("WARN: column for target not found!  (XML id: " + sTargetId + ")");
        } else {
          eTarget = fh.getAssetById(sTargetColId);
          sTargetColName = fh.getAssetName(eTarget);
          bTargetIsPivot = (pivotColumns.hasOwnProperty(fh.getAssetRID(eTargetDS)));
        }

        if (bSourceIsPivot) {
          const sPivotColName = getConditionalPivotColumnName(sSourceColName, sTargetColName);
          const sNewSourceColId = injectSnippetForPivotColumn(fh, sPivotColName, eSource, fh.getAssetById(sSourceId));
          injectSnippetForPivotFlowAsSource(fh,
                        sNewSourceColId,
                        "ds" + sNewSourceColId,
                        "ds" + sNewSourceColId,
                        sTargetId,
                        entryFlows,
                        systemFlows,
                        "[" + sPivotColName + "]",
                        "[" + sPivotColName + "] - [" + sTargetColName + "]");
        }

        if (bTargetIsPivot) {
          const sPivotColName = getConditionalPivotColumnName(sTargetColName, sSourceColName);
          const sNewTargetColId = injectSnippetForPivotColumn(fh, sPivotColName, eTarget, fh.getAssetById(sTargetId));
          injectSnippetForPivotFlowAsTarget(fh,
                        "ds" + sNewTargetColId,
                        sNewTargetColId,
                        sSourceId,
                        "ds" + sNewTargetColId,
                        exitFlows,
                        systemFlows,
                        "[" + sPivotColName + "]",
                        "[" + sSourceColName + "] - [" + sPivotColName + "]");
        }

      }
      
    }
    
  }

}

// Name must be consistent, so going for something basic...
function getConditionalPivotColumnName(pivotColumn, condition) {
  return pivotColumn + " (for " + condition + ")";
}

function getPivotVirtualTableName(pivotTable) {
  return "(pivot) " + pivotTable;
}

// Adds the XML just for the new conditional columns themselves (both database and datastage)
function injectSnippetForPivotColumn(fh, pivotColName, ePivotCol, ePivotDS) {

  // Table first
  const colParentId = fh.getParentAssetId(ePivotCol);
  const eParent = fh.getAssetById(colParentId);

  const pivotTblName = getPivotVirtualTableName(fh.getAssetName(eParent));
  const tblParentId = fh.getParentAssetId(eParent);
  const virtTblId = fh.getTableIdentity(pivotTblName, tblParentId);
  let internalTblId = getIdForObjectIdentity(virtTblId);
  const bTblExists = (typeof internalTblId !== 'undefined' && internalTblId !== null);
  if (!bTblExists) {
    internalTblId = mapObjectToNextId(virtTblId);
    fh.addAsset("ASCLModel.DatabaseTable", pivotTblName, virtTblId, internalTblId, "true", "true", "of_DataSchema", tblParentId);
    bHasBeenCustomised = true;
  }

  // DataStage column IDs
  const dsParentId = fh.getParentAssetId(ePivotDS);
  const dsBaseRID = fh.getAssetRID(ePivotDS);
  const dsColId = "_ngo:" + dsBaseRID.substring(dsBaseRID.indexOf(".") + 1) + "." + ds_rid_gen++;  // Bit of hacking here to get the external ID to be both unique and short enough for xmeta...

  // Database column IDs
  const virtColId = fh.getColumnIdentityFromTableIdentity(pivotColName, virtTblId);
  const internalId = mapObjectToNextId(virtColId);
  const internalIdDS = "ds" + internalId;

  fh.addAsset("ASCLModel.DatabaseField", pivotColName, virtColId, internalId, "true", "true", "of_DatabaseTableOrView", internalTblId);
  fh.addAsset("DataStageX.DSStageColumn", pivotColName, dsColId, internalIdDS, "false", "true", "x_of_JobObject_DSLink", dsParentId);
  bHasBeenCustomised = true;

  return internalId;

}

// Helper functions to generate unique IDs and keep them retrievable later in processing
function mapObjectToNextId(identity) {
  id_gen++;
  const internalId = "xt" + id_gen;
  hmObjectIdentitiesToIds[identity] = internalId;
  return internalId;
}
function getIdForObjectIdentity(identity) {
  return hmObjectIdentitiesToIds[identity];
}

// Adds the XML just for the new flow, from new conditional database column to new conditional datastage column (inbound)
function injectSnippetForPivotFlowAsSource(fh, sEntrySourceId, sEntryTargetId, sSystemSourceId, sSystemTargetId, entryFlows, systemFlows, commentForEntry, commentForSystem) {

  // ENTRY flows -- create new flow from conditional database column to conditional datastage column
  const eExistingMappingEntry = fh.getSubflowBySourceId(entryFlows, sEntrySourceId);
  fh.addFlow(entryFlows, eExistingMappingEntry, sEntrySourceId, sEntryTargetId, commentForEntry, false);
  // SYSTEM flows -- append to existing mapping to datastage column to also go from conditional datastage column
  const eExistingMappingSystem = fh.getSubflowBySourceId(systemFlows, sSystemSourceId);
  fh.addFlow(systemFlows, eExistingMappingSystem, sSystemSourceId, sSystemTargetId, commentForSystem, false);
  bHasBeenCustomised = true;

}

// Adds the XML just for the new flow from new conditional datastage column to new conditional database column (outbound)
function injectSnippetForPivotFlowAsTarget(fh, sExitSourceId, sExitTargetId, sSystemSourceId, sSystemTargetId, exitFlows, systemFlows, commentForExit, commentForSystem) {

  // EXIT flows -- create a new flow from conditional datastage column to conditional database column
  const eExistingMappingExit = fh.getSubflowBySourceId(exitFlows, sExitSourceId);
  fh.addFlow(exitFlows, eExistingMappingExit, sExitSourceId, sExitTargetId, commentForExit, false);
  // SYSTEM flows -- append to existing mapping from datastage column to also go to conditional datastage column
  const eExistingMappingSystem = fh.getSubflowBySourceId(systemFlows, sSystemSourceId);
  fh.addFlow(systemFlows, eExistingMappingSystem, sSystemSourceId, sSystemTargetId, commentForSystem, false);
  bHasBeenCustomised = true;

}

// Basic functions to output the customised lineage
function getFlowFilename(fh, eProj, eJob) {
  return fh.getAssetName(eProj) + "__" + fh.getAssetName(eJob) + ".xml";
}
function outputCustomXML(fh, sFilename) {

  const xmlOut = fh.getCustomisedXML();
  const options = {
    "encoding": 'utf8',
    "mode": 0o644,
    "flag": 'w'
  };
  fs.writeFileSync("/data/semanticLineage/mappedFlows/output/" + sFilename, pd.xml(xmlOut), options);

}
function copyOriginalToMapped(sFilename) {
  fs.copySync("/data/semanticLineage/originalFlows/" + sFilename, "/data/semanticLineage/mappedFlows/source/" + sFilename);
}
