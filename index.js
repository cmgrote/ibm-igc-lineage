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

const Excel = require('exceljs');
const pd = require('pretty-data').pd;
const fs = require('fs-extra');

const FlowHandler = require('./classes/flow-handler');
const OMDHandler = require('./classes/omd-handler');
const AssetTypeFactory = require('./classes/asset-type-factory');

/**
 * Re-usable functions for handling lineage flow documents (XML) and operational metadata (OMD XML)
 * @module ibm-igc-lineage
 * @license Apache-2.0
 * @requires xmldom
 * @requires xpath
 */
const Lineage = (function() {

  const _styles = {

    hidden: {
      font: { size: 8, color: {argb: 'FFFAFAFA'} },
      fill: { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF000000'} }
    },
    createable: {
      font: { bold: true, color: {argb: 'FFFFFFFF'} },
      fill: { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF2D660A'} }
    },
    createableRequired: {
      font: { bold: true, italic: true, color: {argb: 'FFFFFFFF'} },
      fill: { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF4B8400'} }
    },
    createableOptional: {
      font: { italic: true, color: {argb: 'FF2D660A'} },
      fill: { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFB4E051'} }
    },
    noneditable: {
      font: { bold: true, color: {argb: 'FFFFFFFF'} },
      fill: { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF325C80'} }
    },
    noneditableRequired: {
      font: { bold: true, italic: true, color: {argb: 'FFFFFFFF'} },
      fill: { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF4178BE'} }
    },
    noneditableOptional: {
      font: { italic: true, color: {argb: 'FF325C80'} },
      fill: { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF7CC7FF'} }
    }

  };

  // Need to do this asynchronously given the REST calls
  const _addExistingAssets = function(igcrest, workbook, worksheet, writtenSheets, assetType, properties, callback, cbWithWorkbook) {

    const includeProperties = [];
    const aProperties = Object.keys(properties);
    for (let i = 0; i < aProperties.length; i++) {
      // Skip any properties that start with _ (_id, _name), as REST-based search
      // won't work with them and returns them anyway
      if (!aProperties[i].startsWith("_")) {
        includeProperties.push(aProperties[i]);
      }
    }

    const query = {
      "properties": includeProperties,
      "types": [ assetType ],
      "pageSize": "100"
    };

    let err = null;

    igcrest.search(query, function(errSearch, resSearch) {

      if (errSearch !== null) {
        err = "Search failed: " + errSearch;
      } else {
        igcrest.getAllPages(resSearch.items, resSearch.paging, function(errGetAllPages, allResults) {
  
          if (errGetAllPages !== null) {
            err = "Unable to get all assets: " + errGetAllPages;
          } else {
            const hmColToMaxLength = {};
            for (let j = 0; j < allResults.length; j++) {
              const result = allResults[j];
              const values = [];
              for (let k = 0; k < aProperties.length; k++) {
                const propValue = result[ aProperties[k] ];
                values.push(propValue);
                if (!hmColToMaxLength.hasOwnProperty("" + (k + 1))) {
                  hmColToMaxLength["" + (k + 1)] = Math.max(16, propValue.length);
                }
                hmColToMaxLength["" + (k + 1)] = Math.max(propValue.length, hmColToMaxLength["" + (k + 1)]);
              }
              worksheet.addRow(values);

            }
            for (const colIdx in hmColToMaxLength) {
              if (hmColToMaxLength.hasOwnProperty(colIdx)) {
                const col = worksheet.getColumn(parseInt(colIdx));
                col.width = hmColToMaxLength[colIdx];
              }
            }
          }
  
          writtenSheets.push(assetType);
          callback(err, workbook, writtenSheets, cbWithWorkbook);

        });
      }

    });

  };

  // Asynchronous callback handler to check all assets are written prior to final callback
  const _handleAnyErrorOrReturnWorkbook = function(err, workbook, writtenSheets, callback) {
    if (writtenSheets.length === (workbook.worksheets.length - 1)) {
      callback(err, workbook);
    } else if (err !== null) {
      callback(err, null);
    }
  };

  /**
   * Adds entries to the specified workbook for any existing assets of that type in an IGC environment
   *
   * @param {ibm-igc-rest} igcrest - the instantiation of an ibm-igc-rest object, with connection already configured
   * @param {Workbook} workbook - the workbook into which to add existing assets
   * @param {workbookCallback} callback - callback that returns the modified workbook
   */
  const populateTemplateWithExistingAssets = function(igcrest, workbook, callback) {

    const aWorksheets = workbook.worksheets;

    const aWrittenSheets = [];

    for (let i = 0; i < aWorksheets.length; i++) {
      const worksheet = aWorksheets[i];
      if (worksheet.name !== "Lineage Flows") {
        const assetType = AssetTypeFactory.getAssetTypeFromAssetName(worksheet.name);
        const properties = AssetTypeFactory.getAssetProperties(assetType);
        _addExistingAssets(igcrest, workbook, worksheet, aWrittenSheets, assetType, properties, _handleAnyErrorOrReturnWorkbook, callback);
      }
    }

  };

  /**
   * Returns a template (list of headers & pre-defined assets) for the asset specified
   *
   * @param {string} assetName
   * @param {Workbook} [wb] - an optional workbook into which to add this template
   * @returns Workbook an Excel Workbook with the template
   */
  const getTemplateForAssets = function(assetName, wb) {

    const assetType = AssetTypeFactory.getAssetTypeFromAssetName(assetName);  
    if (wb === undefined || wb === null) {
      wb = new Excel.Workbook();
    }
    let ws = wb.addWorksheet(assetName, { properties: { tabColor: {argb: 'FF325C80'} } });

    const properties = AssetTypeFactory.getAssetProperties(assetType);
  
    // First row: output the unique ID (hidden) of the asset's properties
    // Second row: output a nicer-to-display header of the asset's properties ('displayName')
    // Remaining rows: any pre-existing assets of this type (for re-use)
  
    let iCellCount = 1;

    for (const key in properties) {
      if (properties.hasOwnProperty(key)) {
  
        const property = properties[key];

        const col = ws.getColumn(iCellCount);

        const cellId = ws.getCell(1, iCellCount);
        const cellName = ws.getCell(2, iCellCount);

        cellId.value = key;
        cellId.style = _styles.hidden;
  
        cellName.value = property.displayName;
        if (property.hasOwnProperty("isRequired") && property.isRequired) {
          cellName.style = _styles.noneditableRequired;
        } else {
          cellName.style = _styles.noneditableOptional;
        }
        col.width = Math.max(16, property.displayName.length);
        iCellCount++;
  
      }
    }
  
    ws.getRow(1).hidden = true;
    ws.views = [
      {state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }
    ];

    return wb;
    
  };

  const _addDetailsToWorksheet = function(area, details, worksheet, areaIdx, cellIdx) {

    for (let i = 0; i < details.length; i++) {
      const property = details[i];
      const col = worksheet.getColumn(cellIdx);
      if (areaIdx === cellIdx) {
        const cellHeading = worksheet.getCell(1, areaIdx);
        cellHeading.style = (area === "Application") ? _styles.createable : _styles.noneditable;
        cellHeading.value = area;
      }
      const cellName = worksheet.getCell(2, cellIdx);
      cellName.value = property;
      cellName.style = (area === "Application") ? _styles.createableRequired : _styles.noneditableRequired;
      col.width = Math.max(16, property.length);
      /*if (property === "Type") {
        const cellList = worksheet.getCell(3, cellIdx);
        cellList.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['\"' + AssetTypeFactory.getDataAssetTypes().join(",") + '\"'],
          showInputMessage: true,
          promptTitle: 'Select',
          prompt: 'Select the type of asset'
        };
      } else*/ if (property === "RID or Name (for Files only)") {
        const cellValidation = worksheet.getCell(3, cellIdx);
        cellValidation.dataValidation = {
          type: 'custom',
          allowBlank: true,
          formulae: [''],
          showInputMessage: true,
          promptTitle: 'Copy / paste',
          prompt: 'Copy / paste RID of an asset or Name of a File'
        };
        col.width = 50;
      } else if (property === "Name") {
        const cellList = worksheet.getCell(3, cellIdx);
        cellList.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['Applications!$A:$A'],
          showInputMessage: true,
          promptTitle: 'Select',
          prompt: 'Select the application processing input from Source and producing output in Target'
        };
      }
      cellIdx++;
    }
    worksheet.mergeCells(1, areaIdx, 1, cellIdx - 1);

    return cellIdx;

  };

  /**
   * Returns a template (list of headers) for defining lineage flows
   *
   * @param {Workbook} [wb] - an optional workbook into which to add this template
   * @returns Workbook an Excel Workbook with the template
   */
  const getTemplateForLineage = function(wb) {

    if (wb === undefined || wb === null) {
      wb = new Excel.Workbook();
    }
    const ws = wb.addWorksheet("Lineage Flows", { properties: { tabColor: {argb: 'FF2D660A'} } });

    let iCellCount = 1;
    let iAreaStart = 1;

    const sourceDetails = [ "RID or Name (for Files only)" ];
    const appDetails    = [ "Name" ];
    const targetDetails = [ "RID or Name (for Files only)" ];

    iCellCount = _addDetailsToWorksheet("Source", sourceDetails, ws, iAreaStart, iCellCount);
    iAreaStart = iCellCount;
    iCellCount = _addDetailsToWorksheet("Application", appDetails, ws, iAreaStart, iCellCount);
    iAreaStart = iCellCount;
    iCellCount = _addDetailsToWorksheet("Target", targetDetails, ws, iAreaStart, iCellCount);

    ws.views = [
      {state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }
    ];

    return wb;

  };

  const _addParentDetails = function(assetCache, assetDetailsInFlow, qualifiedId, sep, seqId) {

    const assetType = assetDetailsInFlow[qualifiedId]._type;
    const parentType = AssetTypeFactory.getAssetParentTypeFromType(assetType);
    if (parentType !== null) {
      // TODO: this works fine at the coarse-grained granularity currently used, as will only ever
      // go to "host.name" -- which itself has no parent -- but we'll need to revise for more granular
      // lineage entry
      const parentName = assetDetailsInFlow[qualifiedId][parentType + ".name"];
      const parentQualifiedId = parentType + sep + parentName;
      // If it's already been setup by another asset, just re-use the existing ID
      if (assetDetailsInFlow.hasOwnProperty(parentQualifiedId)) {
        const parentXmlId = assetDetailsInFlow[parentQualifiedId]._xmlId;
        assetDetailsInFlow[qualifiedId]._parentType = parentType;
        assetDetailsInFlow[qualifiedId]._parentXmlId = parentXmlId;
      } else {
        // Otherwise create a new asset entry for the parent, with a new ID
        const parentXmlId = "ast" + (seqId++);
        assetDetailsInFlow[qualifiedId]._parentType = parentType;
        assetDetailsInFlow[qualifiedId]._parentXmlId = parentXmlId;
        if (!assetDetailsInFlow.hasOwnProperty(parentQualifiedId)) {
          assetDetailsInFlow[parentQualifiedId] = {};
          assetCache[parentQualifiedId] = {};
        }
        assetDetailsInFlow[parentQualifiedId]._type = parentType;
        assetDetailsInFlow[parentQualifiedId]._name = parentName;
        assetDetailsInFlow[parentQualifiedId]._id = "";
        assetDetailsInFlow[parentQualifiedId]._xmlId = parentXmlId;
        assetCache[parentQualifiedId]._type = parentType;
        assetCache[parentQualifiedId]._name = parentName;
        assetCache[parentQualifiedId]._id = "";
        assetCache[parentQualifiedId]._xmlId = parentXmlId;
      }
    }

    return seqId;

  };

  const _getAssetDetailsFromCache = function(assetCache, qualifiedId, sep) {

    let assetDetails = null;
    if (assetCache.hasOwnProperty(qualifiedId)) {
      assetDetails = assetCache[qualifiedId];
    } else if (assetCache.hasOwnProperty("file" + sep + qualifiedId)) {
      assetDetails = assetCache["file" + sep + qualifiedId];
    }
    return assetDetails;

  };

  /**
   * Loads lineage information as specified in the provided Excel file -- which should have been produced first by the getTemplateForLineage function
   *
   * @see module:ibm-igc-lineage~getTemplateForLineage
   * @param {ibm-igc-rest} igcrest - the instantiation of an ibm-igc-rest object, with connection already configured
   * @param {string} inputFile - name of the .xlsx file containing lineage and any new asset information
   * @param {string} [outputFile] - optional name of an output file, which if provided will avoid automatically sending lineage to the server
   * @param {processCallback} callback - callback that handles the response of processing
   */
  const loadManuallyDefinedFlows = function(igcrest, inputFile, outputFile, callback) {

    // Needs to: 
    // 1. build up a cache of all other asset details (we'll need to output fully-composed assets in next step)
    // 2. create a lineage flow XML file (via flow-handler) with:
    //    a. the source, app, target assets
    //    b. the flows amongst them
    // 3. invoke the REST API with the lineage flow XML file to create the lineage - OR - output XML file

    const hmAssetCache = {};
    const typeAndIdSep = ":|:";
    let uniqSeqId = 1;

    const wb = new Excel.Workbook();
    wb.xlsx.readFile(inputFile).then(function() {

      const aWorksheets = wb.worksheets;
      let lineageFlowWS = null;

      // 1. build up a cache of all asset details (we'll need to output fully-composed assets in next step)
      console.log("1. build up a cache of all asset details (we'll need to output fully-composed assets in next step)");
      for (let i = 0; i < aWorksheets.length; i++) {
        const worksheet = aWorksheets[i];
        const assetName = worksheet.name;
        if (assetName !== "Lineage Flows") {
          const assetType = AssetTypeFactory.getAssetTypeFromAssetName(worksheet.name);
          const paramIds = worksheet.getRow(1).values;
          const rowCount = worksheet.actualRowCount;
          
          // For each row...
          for (let j = 3; j < (rowCount + 1); j++) {
            
            const row = worksheet.getRow(j);
            const rowVals = row.values;
            const create = { _type: assetType };
            
            // Iterate through the values...
            for (let k = 1; k < rowVals.length; k++) {
              const id = paramIds[k];
              const value = rowVals[k];
              create[id] = value;
            }
            // Minor hack so we don't have to refer to these Extended Data Sources by RID
            if (assetType === "file" || assetType === "application") {
              console.log("   +- adding to cache: " + assetType + typeAndIdSep + create._name);
              hmAssetCache[assetType + typeAndIdSep + create._name] = create;
            } else {
              hmAssetCache[create._id] = create;
            }

          }
        } else {
          lineageFlowWS = worksheet;
        }
      }

      // 2. create a lineage flow XML file (via flow-handler) with the source, app, target flows
      console.log("2. create a lineage flow XML file (via flow-handler) with the source, app, target flows");
      const fh = new FlowHandler();
      const assetDetailsInFlow = {};
      
      //    b. the flows amongst them (doing this first to optimise and only bother outputting assets we need to)
      console.log("   b. the flows amongst them (doing this first to optimise and only bother outputting assets we need to)");
      const flowCount = lineageFlowWS.actualRowCount;
      for (let j = 3; j < (flowCount + 1); j++) {
        
        const row = lineageFlowWS.getRow(j);
        
        const rowVals = row.values;
        //const srcType = rowVals[1];
        const srcId   = rowVals[1];
        const appId   = rowVals[2];
        //const tgtType = rowVals[4];
        const tgtId   = rowVals[3];

        const src = srcId;
        const tgt = tgtId;
        const app = "application" + typeAndIdSep + appId; // qualified as we can be certain it is an app -- above could be RID or File name

        if (!assetDetailsInFlow.hasOwnProperty(src)) {
          assetDetailsInFlow[src] = _getAssetDetailsFromCache(hmAssetCache, src, typeAndIdSep);
          assetDetailsInFlow[src]._xmlId = "ast" + (uniqSeqId++);
          uniqSeqId = _addParentDetails(hmAssetCache, assetDetailsInFlow, src, typeAndIdSep, uniqSeqId);
        }
        if (!assetDetailsInFlow.hasOwnProperty(app)) {
          assetDetailsInFlow[app] = _getAssetDetailsFromCache(hmAssetCache, app, typeAndIdSep);
          assetDetailsInFlow[app]._xmlId = "app" + (uniqSeqId++);
        }
        if (!assetDetailsInFlow.hasOwnProperty(tgt)) {
          assetDetailsInFlow[tgt] = _getAssetDetailsFromCache(hmAssetCache, tgt, typeAndIdSep);
          assetDetailsInFlow[tgt]._xmlId = "ast" + (uniqSeqId++);
          uniqSeqId = _addParentDetails(hmAssetCache, assetDetailsInFlow, tgt, typeAndIdSep, uniqSeqId);
        }

        // TODO: this assumes all flows are one input, one output
        // -- should be either consolidating the set of inputs / outputs here, or using the "update"
        // (or not: seems a flow doc with multiple flow units pointing to the same processor still works?)
        const flowUnit = fh.createFlowUnit('DESIGN', assetDetailsInFlow[app]._xmlId, "manually generated lineage");
        fh.addFlow(flowUnit, null, assetDetailsInFlow[src]._xmlId, assetDetailsInFlow[app]._xmlId, "manually created source-to-app", false);
        fh.addFlow(flowUnit, null, assetDetailsInFlow[app]._xmlId, assetDetailsInFlow[tgt]._xmlId, "manually created app-to-output", false);

      }

      //    a. the source, app, target assets
      console.log("   a. the source, app, target assets");
      const aAssetKeys = Object.keys(assetDetailsInFlow);
      for (let i = 0; i < aAssetKeys.length; i++) {
        const typeAndId = aAssetKeys[i];
        console.log("      |- qualifedId: " + typeAndId);
        const assetDetails = _getAssetDetailsFromCache(hmAssetCache, typeAndId, typeAndIdSep);
        console.log("      +- cache result: " + assetDetails);
        const xmlId = assetDetailsInFlow[typeAndId]._xmlId;
        let extraAttrs = [];
        if (assetDetails._type === "data_file") {
          // data_file's also need to have their path provided as an attribute
          extraAttrs.push({
            name: "path",
            value: assetDetails.path
          });
        }
        fh.addAsset(
          assetDetails._type,
          assetDetails._name,
          assetDetails.hasOwnProperty("_id") ? assetDetails._id : "",
          xmlId,
          true,
          false,
          (assetDetailsInFlow[typeAndId].hasOwnProperty("_parentType")) ? assetDetailsInFlow[typeAndId]._parentType : null,
          (assetDetailsInFlow[typeAndId].hasOwnProperty("_parentXmlId")) ? assetDetailsInFlow[typeAndId]._parentXmlId : null,
          extraAttrs);
      }

      // 3. invoke the REST API with the lineage flow XML file to create the lineage - OR - output XML file
      console.log("3. invoke the REST API with the lineage flow XML file to create the lineage - OR - output XML file");
      const flowXML = fh.getCustomisedXML();
      const bOutput = (outputFile !== undefined && outputFile !== "");
  
      if (bOutput) {
        const options = {
          "encoding": 'utf8',
          "mode": 0o644,
          "flag": 'w'
        };
        fs.writeFileSync(outputFile, pd.xml(flowXML), options);
        callback(null, "Successfully wrote file to: " + outputFile);
      } else {
        igcrest.uploadLineageFlow(pd.xmlmin(flowXML), function(errLineage, resLineage) {
          if (errLineage !== null) {
            callback("ERROR: Uploading lineage flow failed -- " + errLineage, resLineage);
          } else {
            callback(null, "Lineage uploaded: " + pd.json(JSON.stringify(resLineage)));
          }
        });
      }

    });

  };

  /**
   * This callback is invoked as the result of modifying an Excel Workbook, providing the modified workbook.
   * @callback workbookCallback
   * @param {string} errorMessage - any error message, or null if no errors
   * @param {Workbook} workbook
   */

  return {
    getTemplateForAssets: getTemplateForAssets,
    getTemplateForLineage: getTemplateForLineage,
    populateTemplateWithExistingAssets: populateTemplateWithExistingAssets,
    loadManuallyDefinedFlows: loadManuallyDefinedFlows
  };

})();

module.exports = Lineage;

if (typeof require === 'function') {
  module.exports.FlowHandler = FlowHandler;
  module.exports.OMDHandler = OMDHandler;
}
