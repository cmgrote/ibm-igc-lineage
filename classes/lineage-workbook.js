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
const fs = require('fs');

const AssetTypeFactory = require('./asset-type-factory');
const FlowHandler = require('./flow-handler');

/**
 * LineageWorkbook class -- for capturing information about data lineage, manually
 */
class LineageWorkbook {

  constructor() {

    this._styles = {
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

    this._wb = new Excel.Workbook();

    this._initLineageSheet();
    this._initApplicationsSheet();
    this._initDataContainersSheet();

    this._flowXML = "";

  }

  /**
   * Loads workbook from the provided XLSX file
   * 
   * @function
   * @param {string} filename
   * @param {completeCallback} callback
   */
  loadFromFile(filename, callback) {
    this._wb.xlsx.readFile(filename).then(callback);
  }

  _initLineageSheet() {
    const wsLineage = this._wb.addWorksheet("Lineage Flows", { properties: { tabColor: {argb: 'FF2D660A'} } });

    wsLineage.columns = [
      { header: 'Source', key: 'source', width: 16 },
      { header: 'Application', key: 'app', width: 16 },
      { header: 'Target', key: 'target', width: 16 }
    ];

    const hSource = wsLineage.getCell(1, 1);
    hSource.style = this._styles.noneditable;

    const hApp    = wsLineage.getCell(1, 2);
    hApp.style    = this._styles.createable;

    const hTarget = wsLineage.getCell(1, 3);
    hTarget.style = this._styles.noneditable;

    wsLineage.views = [
      {state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
    ];
  }

  _initContentSheet(worksheet, properties) {

    // First row: output the unique ID (hidden) of the asset's properties
    // Second row: output a nicer-to-display header of the asset's properties ('displayName')
    // Remaining rows: any pre-existing assets of this type (for re-use)
    let iCellCount = 1;

    for (const key in properties) {
      if (properties.hasOwnProperty(key)) {
  
        const property = properties[key];
        const col = worksheet.getColumn(iCellCount);
        const cellId = worksheet.getCell(1, iCellCount);
        const cellName = worksheet.getCell(2, iCellCount);

        cellId.value = key;
        cellId.style = this._styles.hidden;
  
        cellName.value = property.displayName;
        if (property.hasOwnProperty("isRequired") && property.isRequired) {
          cellName.style = this._styles.noneditableRequired;
        } else {
          cellName.style = this._styles.noneditableOptional;
        }
        col.key = cellId;
        col.width = Math.max(16, property.displayName.length);
        iCellCount++;
  
      }
    }
  
    worksheet.getRow(1).hidden = true;
    worksheet.views = [
      {state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }
    ];

  }

  _initApplicationsSheet() {
    const wsApps = this._wb.addWorksheet("Applications", { properties: { tabColor: {argb: 'FF325C80'} } });
    const properties = AssetTypeFactory.getAssetProperties("application");
    this._initContentSheet(wsApps, properties);
  }

  _initDataContainersSheet() {
    const wsContainers = this._wb.addWorksheet("Data Containers", { properties: { tabColor: {argb: 'FF325C80'} } });
    const properties = AssetTypeFactory.getDataContainerHeaders();
    this._initContentSheet(wsContainers, properties);
  }

  /**
   * Add entry assistance (drop-down list) validations to the lineage sheet.
   * Note: should only be done after populating the workbook with existing assets
   *
   * @function
   */
  addValidationsToLineageSheet() {

    const worksheet = this._wb.getWorksheet("Lineage Flows");

    const wsDataContainers = this._wb.getWorksheet("Data Containers");
    const containerFormula = "'Data Containers'!$A$3:$A$" + wsDataContainers.rowCount;

    const wsApps = this._wb.getWorksheet("Applications");
    const appFormula = "'Applications'!$B$3:$B$" + wsApps.rowCount;

    const colSource = worksheet.getColumn(1);
    const cellSource = worksheet.getCell('A2');
    cellSource.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [ containerFormula ],
      showInputMessage: true,
      promptTitle: 'Select',
      prompt: 'Select identity of a data repository asset'
    };
    colSource.width = 50;

    const colApp = worksheet.getColumn(2);
    const cellApp = worksheet.getCell('B2');
    cellApp.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [ appFormula ],
      showInputMessage: true,
      promptTitle: 'Select',
      prompt: 'Select the application processing input from Source and producing output in Target'
    };
    colApp.width = 16;

    const colTarget = worksheet.getColumn(3);
    const cellTarget = worksheet.getCell('C2');
    cellTarget.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [ containerFormula ],
      showInputMessage: true,
      promptTitle: 'Select',
      prompt: 'Select identity of a data repository asset'
    };
    colTarget.width = 50;

  }

  /**
   * Populate the lineage workbook with existing assets from an environment
   *
   * @function
   * @param {ibm-igc-rest} igcrest - the instantiation of an ibm-igc-rest object, with connection already configured
   * @param {completeCallback} callback - callback that returns once population is completed
   */
  populateWithExistingAssets(igcrest, callback) {

    const writtenAssetTypes = [];

    const wsApps = this._wb.getWorksheet("Applications");
    this._addExistingAssets(igcrest, wsApps, writtenAssetTypes, "application", this._handleAnyErrorOnPopulation, callback);

    const wsData = this._wb.getWorksheet("Data Containers");
    const aDataTypeNames = AssetTypeFactory.getDataAssetTypes();
    for (let i = 0; i < aDataTypeNames.length; i++) {
      const dataTypeName = aDataTypeNames[i];
      const assetType = AssetTypeFactory.getAssetTypeFromAssetName(dataTypeName);
      this._addExistingAssets(igcrest, wsData, writtenAssetTypes, assetType, this._handleAnyErrorOnPopulation, callback);
    }

  }

  _handleAnyErrorOnPopulation(err, writtenAssetTypes, callback) {
    // Data asset types + 1 (for applications) means all data is retrieved & populated
    if (writtenAssetTypes.length === (AssetTypeFactory.getDataAssetTypes().length + 1) || err !== null) {
      callback(err);
    }
  }

  _addExistingAssets(igcrest, worksheet, writtenAssetTypes, assetType, cbCheckCompletion, cbOnCompletion) {

    const properties = AssetTypeFactory.getAssetProperties(assetType);

    const includeProperties = [];
    const aProperties = Object.keys(properties);
    for (let i = 0; i < aProperties.length; i++) {
      // Skip any properties that start with _ (_id, _name), as REST-based search won't work with them and returns them anyway
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
              const values = {};
              for (let k = 0; k < aProperties.length; k++) {
                const propKey   = aProperties[k];
                const propValue = result[ propKey ];
                values[propKey] = propValue;
                if (!hmColToMaxLength.hasOwnProperty("" + (k + 1))) {
                  hmColToMaxLength["" + (k + 1)] = Math.max(16, propValue.length);
                }
                hmColToMaxLength["" + (k + 1)] = Math.max(propValue.length, hmColToMaxLength["" + (k + 1)]);
              }
              if (values._type !== "application") {
                values.__spreadsheetId = _getQualifiedIdForContainer(values, 1);
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
  
          writtenAssetTypes.push(assetType);
          cbCheckCompletion(err, writtenAssetTypes, cbOnCompletion);

        });
      }

    });

    function _getQualifiedIdForContainer(containerDetails, rowIdx) {
      return {
        formula: 'CONCATENATE(C' + rowIdx + ', "::", IF(E' + rowIdx + '="", "", CONCATENATE(E' + rowIdx + ', "::")), IF(F' + rowIdx + '="", "", CONCATENATE(F' + rowIdx + ', "/")), D' + rowIdx + ')',
        result: containerDetails._type + "::" +
              (containerDetails.hasOwnProperty("host.name") ? containerDetails["host.name"] + "::" : "") +
              (containerDetails.hasOwnProperty("path") ? containerDetails.path + "/" : "") +
              containerDetails._name
      };
    }

  }

  /**
   * Write out the template to the specified file
   *
   * @function
   * @param {string} filename
   */
  writeTemplate(filename) {
    this._wb.xlsx.writeFile(filename).then(function() {
      console.log("Created template in: " + filename);
    });
  }

  _getRowAsObject(keys, values) {
    const obj = {};
    for (let k = 1; k < values.length; k++) {
      const id = keys[k];
      const value = values[k];
      obj[id] = value;
    }
    return obj;
  }

  /**
   * Generate a flow XML document that contains the lineage definitions of this workbook
   *
   * @function
   * @returns {string} XML flow document representation of the lineage definitions in the workbook
   */
  generateFlowXML() {

    const hmAssetCache = {};
    const typeAndIdSep = ":|:";
    let uniqSeqId = 1;

    // 1. build up a cache of all asset details (we'll need to output fully-composed assets in next step)
    const wsContainers  = this._wb.getWorksheet("Data Containers");
    const containerIds  = wsContainers.getRow(1).values;
    const containerRows = wsContainers.rowCount;
    for (let j = 3; j < (containerRows + 1); j++) {
      const row = wsContainers.getRow(j);
      const create = this._getRowAsObject(containerIds, row.values);
      hmAssetCache[ create.__spreadsheetId.result ] = create;
    }

    const wsApps  = this._wb.getWorksheet("Applications");
    const appIds  = wsApps.getRow(1).values;
    const appRows = wsApps.rowCount;
    for (let j = 3; j < (appRows + 1); j++) {
      const row = wsApps.getRow(j);
      const create = this._getRowAsObject(appIds, row.values);
      create._type = "application";
      hmAssetCache[ create._name ] = create;
    }

    // 2. create a lineage flow XML file (via flow-handler) with the source, app, target flows
    const fh = new FlowHandler();
    const assetDetailsInFlow = {};
    
    //    b. the flows amongst them (doing this first to optimise and only bother outputting assets we need to)
    const wsLineage = this._wb.getWorksheet("Lineage Flows");
    const flowCount = wsLineage.rowCount;
    for (let j = 2; j < (flowCount + 1); j++) {
      
      const row = wsLineage.getRow(j);
      
      const rowVals = row.values;
      const srcId   = rowVals[1];
      const appId   = rowVals[2];
      const tgtId   = rowVals[3];

      if (!assetDetailsInFlow.hasOwnProperty(srcId)) {
        assetDetailsInFlow[srcId] = hmAssetCache[srcId];
        assetDetailsInFlow[srcId]._xmlId = "ast" + (uniqSeqId++);
        _addParentDetails(srcId);
      }
      if (!assetDetailsInFlow.hasOwnProperty(appId)) {
        assetDetailsInFlow[appId] = hmAssetCache[appId];
        assetDetailsInFlow[appId]._xmlId = "app" + (uniqSeqId++);
      }
      if (!assetDetailsInFlow.hasOwnProperty(tgtId)) {
        assetDetailsInFlow[tgtId] = hmAssetCache[tgtId];
        assetDetailsInFlow[tgtId]._xmlId = "ast" + (uniqSeqId++);
        _addParentDetails(tgtId);
      }

      // TODO: this assumes all flows are one input, one output
      // -- should be either consolidating the set of inputs / outputs here, or using the "update"
      // (or not: seems a flow doc with multiple flow units pointing to the same processor still works?)
      const flowUnit = fh.createFlowUnit('DESIGN', assetDetailsInFlow[appId]._xmlId, "manually generated lineage");
      fh.addFlow(flowUnit, null, assetDetailsInFlow[srcId]._xmlId, assetDetailsInFlow[appId]._xmlId, "manually created source-to-app", false);
      fh.addFlow(flowUnit, null, assetDetailsInFlow[appId]._xmlId, assetDetailsInFlow[tgtId]._xmlId, "manually created app-to-output", false);

    }

    //    a. the source, app, target assets
    const aAssetKeys = Object.keys(assetDetailsInFlow);
    for (let i = 0; i < aAssetKeys.length; i++) {

      const assetKey = aAssetKeys[i];
      const assetDetails = hmAssetCache[assetKey];
      const xmlId = assetDetailsInFlow[assetKey]._xmlId;

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
        (assetDetailsInFlow[assetKey].hasOwnProperty("_parentType")) ? assetDetailsInFlow[assetKey]._parentType : null,
        (assetDetailsInFlow[assetKey].hasOwnProperty("_parentXmlId")) ? assetDetailsInFlow[assetKey]._parentXmlId : null,
        extraAttrs);
    }

    this._flowXML = fh.getCustomisedXML();

    function _addParentDetails(cacheId) {

      const assetDetails = hmAssetCache[cacheId];
      const assetType = assetDetails._type;
      const parentType = AssetTypeFactory.getAssetParentTypeFromType(assetType);
      if (parentType !== null) {
        // TODO: this works fine at the coarse-grained granularity currently used, as will only ever
        // go to "host.name" -- which itself has no parent -- but we'll need to revise for more granular
        // lineage entry
        const parentName = assetDetails[parentType + ".name"];
        const parentQualifiedId = parentType + typeAndIdSep + parentName;
        // If it's already been setup by another asset, just re-use the existing ID
        if (assetDetailsInFlow.hasOwnProperty(parentQualifiedId)) {
          const parentXmlId = assetDetailsInFlow[parentQualifiedId]._xmlId;
          assetDetailsInFlow[cacheId]._parentType = parentType;
          assetDetailsInFlow[cacheId]._parentXmlId = parentXmlId;
        } else {
          // Otherwise create a new asset entry for the parent, with a new ID
          const parentXmlId = "ast" + (uniqSeqId++);
          assetDetailsInFlow[cacheId]._parentType = parentType;
          assetDetailsInFlow[cacheId]._parentXmlId = parentXmlId;
          if (!assetDetailsInFlow.hasOwnProperty(parentQualifiedId)) {
            assetDetailsInFlow[parentQualifiedId] = {};
            hmAssetCache[parentQualifiedId] = {};
          }
          assetDetailsInFlow[parentQualifiedId]._type = parentType;
          assetDetailsInFlow[parentQualifiedId]._name = parentName;
          assetDetailsInFlow[parentQualifiedId]._id = "";
          assetDetailsInFlow[parentQualifiedId]._xmlId = parentXmlId;
          hmAssetCache[parentQualifiedId]._type = parentType;
          hmAssetCache[parentQualifiedId]._name = parentName;
          hmAssetCache[parentQualifiedId]._id = "";
          hmAssetCache[parentQualifiedId]._xmlId = parentXmlId;
        }
      }
  
    }

  }

  /**
   * Upload the lineage flow XML for the workbook to IGC
   * 
   * @function
   * @param {ibm-igc-rest} igcrest - the instantiation of an ibm-igc-rest object, with connection already configured
   * @param {completeCallback} callback
   */
  uploadFlowXMLToIGC(igcrest, callback) {

    this.generateFlowXML();

    igcrest.uploadLineageFlow(pd.xmlmin(this._flowXML), function(errLineage) {
      if (errLineage !== null) {
        callback("ERROR: Uploading lineage flow failed -- " + errLineage);
      } else {
        callback(null);
      }
    });

  }

  /**
   * Write out the lineage flow XML for the workbook to the specified file
   *
   * @function
   * @param {string} filename
   */
  writeFlowXML(filename) {

    this.generateFlowXML();
  
    const options = {
      "encoding": 'utf8',
      "mode": 0o644,
      "flag": 'w'
    };
    fs.writeFileSync(filename, pd.xml(this._flowXML), options);

  }

  /**
   * This callback is invoked as the result of work completing, providing a status.
   * @callback completeCallback
   * @param {string} errorMessage - any error message, or null if no errors
   */

}

module.exports = LineageWorkbook;
