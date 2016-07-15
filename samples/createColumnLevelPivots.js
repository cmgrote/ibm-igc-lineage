#!/usr/bin/env node

/**
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

//-------------------------------------------------------------------------------------------
//
// Example automation of lineage customisation for jobs that either normalise or de-normalise
// column-level data, and where the ultimate source / target column name are the same
//
//-------------------------------------------------------------------------------------------

const fs = require('fs-extra');
const pd = require('pretty-data').pd;
var igcrest = require('ibm-igc-rest');
var igclineage = require('ibm-igc-lineage');

// Command-line setup
var yargs = require('yargs');
var argv = yargs
    .usage('Usage: $0 -f <path> -r <path> -d <host>:<port> -u <user> -p <password>')
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
var inputFile = argv.file;
var mapFile = argv.rids;
var host_port = argv.domain.split(":");
igcrest.setAuth(argv.deploymentUser, argv.deploymentUserPassword);
igcrest.setServer(host_port[0], host_port[1]);

var pivotColumns = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
var bHasBeenCustomised = false;

// To keep generated IDs unique and retrievable
var id_gen = 0;
var ds_rid_gen = 0;
var hmObjectIdentitiesToIds = {};

// Read input XML
var xmldata = fs.readFileSync(inputFile, 'utf8');
var fh = new igclineage.FlowHandler();
fh.parseXML(xmldata.toString());

// ... get basic information from XML
var eProj = fh.getProjectNode();
var eJob = fh.getJobNode();
console.log("Customising lineage for: " + fh.getAssetName(eProj) + ", " + fh.getAssetName(eJob) + " (" + fh.getAssetRID(eJob) + ")");

var eEntryFlows = fh.getEntryFlows();
var eExitFlows = fh.getExitFlows();
var eSystemFlows = fh.getSystemFlows();

// Kick-off the automated customisation...
var innerFlows = fh.getSubflows(eSystemFlows);
for (var i = 0; i < innerFlows.length; i++) {
  var eInnerFlow = innerFlows[i];
  var sSources = eInnerFlow.getAttribute("sourceIDs");
  var sTargets = eInnerFlow.getAttribute("targetIDs");
  resolveSourceToTargetMappings(eEntryFlows, eExitFlows, eSystemFlows, sSources, sTargets);
}

if (bHasBeenCustomised) {
  // Output the results
  var sFlowFilename = getFlowFilename(eProj, eJob);
  outputCustomXML(sFlowFilename);
  copyOriginalToMapped(sFlowFilename);
  igcrest.detectLineageForJob(fh.getAssetRID(eJob), function(err, resLineage) {
    console.log("... lineage re-detection status: " + resLineage.message);
  });
} else {
  console.log("... no customisation needed, default lineage retained.");
}

// Most of the work: the 'sources' and 'targets' are the DataStage column-based ones (system flows)
// - for each of the source IDs, determine what data store (column) feeds that DS-column
// - for each of the target IDs, determine what data store (column) is written by that DS-column
// - check each column (read or written) for whether it matches one marked as a pivot
// - if so, handle it accordingly (add a new conditional column and re-map the flows to this new column)
function resolveSourceToTargetMappings(entryFlows, exitFlows, systemFlows, sources, targets) {
  
  var bSourceIsPivot = false;
  var bTargetIsPivot = false;

  var aTargetIDs = targets.split(" ");
  var aSourceIDs = sources.split(" ");

  for (var i = 0; i < aSourceIDs.length; i++) {
    var sSourceId = aSourceIDs[i];
    var eSourceDS = fh.getAssetById(sSourceId);
    var sSourceColId = fh.getRepositoryIdFromDSSourceId(entryFlows, sSourceId);
    if (sSourceColId == null) {
      console.warn("WARN: column for source not found!  (XML id: " + sSourceId + ")");
    } else {
      
      var eSource = fh.getAssetById(sSourceColId);
      var sSourceColName = fh.getAssetName(eSource);
      bSourceIsPivot = (pivotColumns.hasOwnProperty(fh.getAssetRID(eSourceDS)));
      
      for (var j = 0; j < aTargetIDs.length; j++) {
        var sTargetId = aTargetIDs[j];
        var eTargetDS = fh.getAssetById(sTargetId);
        var sTargetColId = fh.getRepositoryIdFromDSTargetId(exitFlows, sTargetId);
        if (sTargetColId == null) {
          console.warn("WARN: column for target not found!  (XML id: " + sTargetId + ")");
        } else {
          var eTarget = fh.getAssetById(sTargetColId);
          var sTargetColName = fh.getAssetName(eTarget);
          bTargetIsPivot = (pivotColumns.hasOwnProperty(fh.getAssetRID(eTargetDS)));
        }

        if (bSourceIsPivot) {
          var sPivotColName = getConditionalPivotColumnName(sSourceColName, sTargetColName);
          var sNewSourceColId = injectSnippetForPivotColumn(sPivotColName, eSource, fh.getAssetById(sSourceId));
          injectSnippetForPivotFlowAsSource(
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
          var sPivotColName = getConditionalPivotColumnName(sTargetColName, sSourceColName);
          var sNewTargetColId = injectSnippetForPivotColumn(sPivotColName, eTarget, fh.getAssetById(sTargetId));
          injectSnippetForPivotFlowAsTarget(
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
function injectSnippetForPivotColumn(pivotColName, ePivotCol, ePivotDS) {

  // Table first
  var colParentId = fh.getParentAssetId(ePivotCol);
  var eParent = fh.getAssetById(colParentId);

  var pivotTblName = getPivotVirtualTableName(fh.getAssetName(eParent));
  var tblParentId = fh.getParentAssetId(eParent);
  var virtTblId = fh.getTableIdentity(pivotTblName, tblParentId);
  var internalTblId = getIdForObjectIdentity(virtTblId);
  var bTblExists = (internalTblId != null);
  if (!bTblExists) {
    internalTblId = mapObjectToNextId(virtTblId);
    fh.addAsset("ASCLModel.DatabaseTable", pivotTblName, virtTblId, internalTblId, "true", "true", "of_DataSchema", tblParentId);
    bHasBeenCustomised = true;
  }

  // DataStage column IDs
  var dsParentId = fh.getParentAssetId(ePivotDS);
  var dsBaseRID = fh.getAssetRID(ePivotDS);
  var dsColId = "_ngo:" + dsBaseRID.substring(dsBaseRID.indexOf(".") + 1) + "." + ds_rid_gen++;  // Bit of hacking here to get the external ID to be both unique and short enough for xmeta...

  // Database column IDs
  var virtColId = fh.getColumnIdentityFromTableIdentity(pivotColName, virtTblId);
  var internalId = mapObjectToNextId(virtColId);
  var internalIdDS = "ds" + internalId;

  fh.addAsset("ASCLModel.DatabaseField", pivotColName, virtColId, internalId, "true", "true", "of_DatabaseTableOrView", internalTblId);
  fh.addAsset("DataStageX.DSStageColumn", pivotColName, dsColId, internalIdDS, "false", "true", "x_of_JobObject_DSLink", dsParentId);
  bHasBeenCustomised = true;

  return internalId;

}

// Helper functions to generate unique IDs and keep them retrievable later in processing
function mapObjectToNextId(identity) {
  id_gen++;
  var internalId = "xt" + id_gen;
  hmObjectIdentitiesToIds[identity] = internalId;
  return internalId;
}
function getIdForObjectIdentity(identity) {
  return hmObjectIdentitiesToIds[identity];
}

// Adds the XML just for the new flow, from new conditional database column to new conditional datastage column (inbound)
function injectSnippetForPivotFlowAsSource(sEntrySourceId, sEntryTargetId, sSystemSourceId, sSystemTargetId, entryFlows, systemFlows, commentForEntry, commentForSystem) {

  // ENTRY flows -- create new flow from conditional database column to conditional datastage column
  var eExistingMappingEntry = fh.getSubflowBySourceId(entryFlows, sEntrySourceId);
  fh.addFlow(entryFlows, eExistingMappingEntry, sEntrySourceId, sEntryTargetId, commentForEntry, false);
  // SYSTEM flows -- append to existing mapping to datastage column to also go from conditional datastage column
  var eExistingMappingSystem = fh.getSubflowBySourceId(systemFlows, sSystemSourceId);
  fh.addFlow(systemFlows, eExistingMappingSystem, sSystemSourceId, sSystemTargetId, commentForSystem, false);
  bHasBeenCustomised = true;

}

// Adds the XML just for the new flow from new conditional datastage column to new conditional database column (outbound)
function injectSnippetForPivotFlowAsTarget(sExitSourceId, sExitTargetId, sSystemSourceId, sSystemTargetId, exitFlows, systemFlows, commentForExit, commentForSystem) {

  // EXIT flows -- create a new flow from conditional datastage column to conditional database column
  var eExistingMappingExit = fh.getSubflowBySourceId(exitFlows, sExitSourceId);
  fh.addFlow(exitFlows, eExistingMappingExit, sExitSourceId, sExitTargetId, commentForExit, false);
  // SYSTEM flows -- append to existing mapping from datastage column to also go to conditional datastage column
  var eExistingMappingSystem = fh.getSubflowBySourceId(systemFlows, sSystemSourceId);
  fh.addFlow(systemFlows, eExistingMappingSystem, sSystemSourceId, sSystemTargetId, commentForSystem, false);
  bHasBeenCustomised = true;

}

// Basic functions to output the customised lineage
function getFlowFilename(eProj, eJob) {
  return fh.getAssetName(eProj) + "__" + fh.getAssetName(eJob) + ".xml";
}
function outputCustomXML(sFilename) {

  var xmlOut = fh.getCustomisedXML();
  var options = {
    "encoding": 'utf8',
    "mode": 0644,
    "flag": 'w'
  }
  fs.writeFileSync("/data/semanticLineage/mappedFlows/output/" + sFilename, pd.xml(xmlOut), options);

}
function copyOriginalToMapped(sFilename) {
  fs.copySync("/data/semanticLineage/originalFlows/" + sFilename, "/data/semanticLineage/mappedFlows/source/" + sFilename);
}
