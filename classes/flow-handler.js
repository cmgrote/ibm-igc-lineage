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

const xmldom = require('xmldom');
const xpath = require('xpath');

/**
 * FlowHandler class -- for handling IGC Flow Documents (XML)
 * @example
 * // parses an XML flow document held in 'xmlString' as a string
 * var igclineage = require('ibm-igc-lineage');
 * var fh = new igclineage.FlowHandler();
 * fh.parseXML(xmlString);
 */
class FlowHandler {

  constructor() {
    this._xmlOriginal = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<doc xmlns=\"http://www.ibm.com/iis/flow-doc\">\n  <assets>\n  </assets>\n  <flowUnits>\n  </flowUnits>\n</doc>";
    this._doc = new xmldom.DOMParser().parseFromString(this._xmlOriginal);
    this._eProject = null;
    this._eJob = null;
    this._select = xpath.useNamespaces({"flowdoc": "http://www.ibm.com/iis/flow-doc"});
  }

  /**
   * Parses an XML flow document
   *
   * @function
   * @param {string} xml
   */
  parseXML(xml) {
    this._xmlOriginal = xml;
    this._doc = new xmldom.DOMParser().parseFromString(xml);
    this._eProject = this.getAssetByClass("DataStageX.DSProject");
    this._eJob = this.getAssetByClass("DataStageX.x_JOB_PARALLEL");
  }

  /**
   * @private
   */
  _getElementsByContext(expression, context) {
    return this._select(expression, context);
  }
  _getElementByContext(expression, context) {
    return this._getElementsByContext(expression, context)[0];
  }
  getElements(expression) {
    return this._getElementsByContext(expression, this._doc);
  }
  getElement(expression) {
    return this.getElements(expression)[0];
  }

  /**
   * Gets the name of an asset
   *
   * @function
   * @param {Asset} asset
   * @returns {string}
   */
  getAssetName(asset) {
    return asset.getAttribute("repr");
  }

  /**
   * Gets the RID of an asset
   *
   * @function
   * @param {Asset} asset
   * @returns {string}
   */
  getAssetRID(asset) {
    return asset.getAttribute("externalID");
  }

  /**
   * @private
   */
  getAssetByClass(className) {
    return this.getElement("/flowdoc:doc/flowdoc:assets/flowdoc:asset[@class='" + className + "']");
  }

  /**
   * Gets an asset by its unique flow XML ID (not RID)
   *
   * @function
   * @param {string} id
   * @returns {Asset}
   */
  getAssetById(id) {
    return this.getElement("/flowdoc:doc/flowdoc:assets/flowdoc:asset[@ID='" + id + "']");
  }

  /**
   * Gets the name of an asset based on its unique flow XML ID (not RID)
   *
   * @function
   * @param {string} id
   * @returns {string}
   */
  getAssetNameById(id) {
    return this.getAssetName(this.getAssetById(id));
  }

  /**
   * Gets the Transformation Project details
   *
   * @function
   * @returns {Asset}
   */
  getProjectNode() {
    return this._eProject;
  }

  /**
   * Gets the Job details
   *
   * @function
   * @returns {Asset}
   */
  getJobNode() {
    return this._eJob;
  }

  /**
   * Creates a new flowUnit
   *
   * @param {string} flowType - DESIGN or SYSTEM
   * @param {string} xmlIdOfProcessor - the internal XML flow doc ID of the processing routine (ETL job, etc)
   * @param {string} [comment] - an optional comment to include on the flow
   */
  createFlowUnit(flowType, xmlIdOfProcessor, comment) {
    
    const eFlows = this.getElement("/flowdoc:doc/flowdoc:flowUnits");
    
    // New flow unit
    const eNewFlow = this._doc.createElement("flowUnit");
    eNewFlow.setAttribute("assetID", xmlIdOfProcessor);
    eFlows.appendChild(eNewFlow);
    
    // New subflow within the unit (this ~= job / routine doing data processing)
    const eSubFlow = this._doc.createElement("subFlows");
    eSubFlow.setAttribute("flowType", flowType);
    if (comment !== null) {
      eSubFlow.setAttribute("comment", comment);
    }
    eNewFlow.appendChild(eSubFlow);

/*    
    // New in-bound flow (from source => job / routine)
    const flowIn = this._doc.createElement("flow");
    flowIn.setAttribute("sourceIDs", sourceIds.join(" "));
    flowIn.setAttribute("targetIDs", xmlIdOfProcessor);
    eSubFlow.appendChild(flowIn);

    // New out-bound flow (from job / routine => output)
    const flowOut = this._doc.createElement("flow");
    flowOut.setAttribute("sourceIDs", xmlIdOfProcessor);
    flowOut.setAttribute("targetIDs", outputIds.join(" "));
    eSubFlow.appended(flowOut);
*/

    return eNewFlow;

  }

  /**
   * Gets the details for ENTRY flows (data store-to-DataStage)
   *
   * @function
   * @returns {FlowList}
   */
  getEntryFlows() {
    return this.getElement("/flowdoc:doc/flowdoc:flowUnits/flowdoc:flowUnit/flowdoc:subFlows[@reuseType='ENTRY']");
  }

  /**
   * Gets the details for EXIT flows (DataStage-to-data store)
   *
   * @function
   * @returns {FlowList}
   */
  getExitFlows() {
    return this.getElement("/flowdoc:doc/flowdoc:flowUnits/flowdoc:flowUnit/flowdoc:subFlows[@reuseType='EXIT']");
  }

  /**
   * Gets the details for INSIDE flows (DataStage-to-DataStage)
   *
   * @function
   * @returns {FlowList}
   */
  getSystemFlows() {
    return this.getElement("/flowdoc:doc/flowdoc:flowUnits/flowdoc:flowUnit/flowdoc:subFlows[@flowType='SYSTEM']");
  }

  /**
   * Gets the details of DESIGN flows
   *
   * @function
   * @returns {FlowList}
   */
  getDesignFlows() {
    return this.getElement("/flowdoc:doc/flowdoc:flowUnits/flowdoc:flowUnit/flowdoc:subFlows[@flowType='DESIGN']");
  }

  /**
   * Gets all of the subflows from a set of flows
   *
   * @function
   * @param {FlowList} flows - the set of flows for which to get subflows
   * @returns {FlowList} the subflows
   */
  getSubflows(flows) {
    return this._getElementsByContext("flowdoc:subFlows/flowdoc:flow", flows);
  }

  /**
   * Gets a specific subflow based on its source
   *
   * @function
   * @param {FlowList} flows - the set of flows from which to get the subflow
   * @param {string} sourceId - the sourceID of the subflow
   * @returns {Flow} the subflow
   */
  getSubflowBySourceId(flows, sourceId) {
    return this._getElementByContext("flowdoc:subFlows/flowdoc:flow[@sourceIDs='" + sourceId + "']", flows);
  }

  /**
   * Gets a specific subflow based on its target
   *
   * @function
   * @param {FlowList} flows - the set of flows from which to get the subflow
   * @param {string} targetId - the targetID of the subflow
   * @returns {Flow} the subflow
   */
  getSubflowsByTargetId(flows, targetId) {
    return this._getElementsByContext("flowdoc:subFlows/flowdoc:flow[@targetIDs='" + targetId + "']", flows);
  }

  /**
   * Gets the ID of the parent (reference) of the provided asset
   *
   * @function
   * @param {Asset} asset
   * @returns {string}
   */
  getParentAssetId(asset) {
    return this._getElementByContext("flowdoc:reference", asset).getAttribute("assetIDs");
  }

  /**
   * Gets the ID of the source repository that is mapped to the provided DataStage target
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getEntryFlows
   * @param {FlowList} entryFlows - the set of ENTRY flows
   * @param {string} DSSourceId - the DataStage target (targetID) of the ENTRY flow
   * @returns {string} the mapped source repository (sourceID) of the ENTRY flow
   */
  getRepositoryIdFromDSSourceId(entryFlows, DSSourceId) {
    const element = this._getElementByContext("flowdoc:subFlows/flowdoc:flow[@targetIDs='" + DSSourceId + "']", entryFlows);
    if (typeof element !== 'undefined' && element !== null) {
      return element.getAttribute("sourceIDs");
    } else {
      return null;
    }
  }

  /**
   * Gets the ID of the target repository that is mapped from the provided DataStage source
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getExitFlows
   * @param {FlowList} exitFlows - the set of EXIT flows
   * @param {string} DSTargetId - the DataStage source (sourceID) of the EXIT flow
   * @returns {string} the mapped target repository (targetID) of the EXIT flow
   */
  getRepositoryIdFromDSTargetId(exitFlows, DSTargetId) {
    const element = this._getElementByContext("flowdoc:subFlows/flowdoc:flow[@sourceIDs='" + DSTargetId + "']", exitFlows);
    if (typeof element !== 'undefined' && element !== null) {
      return element.getAttribute("targetIDs");
    } else {
      return null;
    }
  }

  /**
   * Gets the identity string (externalID) for the provided database table
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getParentAssetId
   * @param {string} tblName - the name of the database table
   * @param {string} schemaId - the ID of the parent database schema
   * @returns {string}
   */
  getTableIdentity(tblName, schemaId) {
    const eSchema = this.getAssetById(schemaId);
    const schemaName = this.getAssetName(eSchema);
    const dcnId = this.getParentAssetId(eSchema);
    const eDCN = this.getAssetById(dcnId);
    const dcnName = this.getAssetName(eDCN);
    const creationTool = this._getElementByContext("flowdoc:attribute[@name='creationTool']", eDCN).getAttribute("value");
    const hostId = this.getParentAssetId(eDCN);
    const eHost = this.getAssetById(hostId);
    const hostName = this.getAssetName(eHost);
    return "_ngo:table:" +
      "_ngo:db:" + hostName.toLowerCase() +
      "::" + dcnName.toLowerCase() +
      "::" + creationTool.toLowerCase() +
      "::" + schemaName.toLowerCase() +
      "::" + tblName.toLowerCase();
  }

  /**
   * Gets the identity string (externalID) for the provided database column
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getParentAssetId
   * @param {string} colName - the name of the database column
   * @param {string} tableId - the ID of the parent database table
   * @returns {string}
   */
  getColumnIdentity(colName, tableId) {
    const eTable = this.getAssetById(tableId);
    const tableName = this.getAssetName(eTable);
    const schemaId = this.getParentAssetId(eTable);
    const tableIdentity = this.getTableIdentity(tableName, schemaId);
    return "_ngo:" +
      colName.toLowerCase() +
      tableIdentity.replace("_ngo:table:", "::");
  }

  /**
   * Gets the database column identity string (externalID) from an existing database table identity string
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getTableIdentity
   * @param {string} colName - the name of the database column
   * @param {string} tableIdentity - the identity string (externalID) of the parent database table
   * @returns {string}
   */
  getColumnIdentityFromTableIdentity(colName, tableIdentity) {
    return "_ngo:" +
      colName.toLowerCase() +
      tableIdentity.replace("_ngo:table:", "::");
  }

  /**
   * Adds an asset to the flow XML
   *
   * @function
   * @param {string} className - the classname of the data type of the asset (e.g. ASCLModel.DatabaseField)
   * @param {string} name - the name of the asset
   * @param {string} rid - the RID of the asset, or a virtual identity (externalID)
   * @param {string} xmlId - the unique ID of the asset within the XML flow document
   * @param {string} matchByName - should be one of ['true', 'false']
   * @param {string} virtualOnly - should be one of ['true', 'false']
   * @param {string} [parentType] - the classname of the asset's parent data type (e.g. ASCLModel.DatabaseTable)
   * @param {string} [parentId] - the unique ID of the asset's parent within the XML flow document
   * @param {Object[]} [additionalAttrs] - any extra attributes to set on the asset, each element of the array being { name: "NameOfAttr", value: "ValueOfAttr" }
   */
  addAsset(className, name, rid, xmlId, matchByName, virtualOnly, parentType, parentId, additionalAttrs) {
    const eAsset = this._doc.createElement("asset");
    eAsset.setAttribute("class", className);
    eAsset.setAttribute("repr", name);
    eAsset.setAttribute("externalID", rid);
    eAsset.setAttribute("ID", xmlId);
    eAsset.setAttribute("matchByName", matchByName);
    eAsset.setAttribute("virtualOnly", virtualOnly);
    const eAttr = this._doc.createElement("attribute");
    eAttr.setAttribute("name", "name");
    eAttr.setAttribute("value", name);
    eAsset.appendChild(eAttr);
    if (additionalAttrs !== null) {
      for (let i = 0; i < additionalAttrs.length; i++) {
        const eAttrExtra = this._doc.createElement("attribute");
        eAttrExtra.setAttribute("name", additionalAttrs[i].name);
        eAttrExtra.setAttribute("value", additionalAttrs[i].value);
        eAsset.appendChild(eAttrExtra);
      }
    }
    if (parentType !== null && parentId !== null) {
      const eRef = this._doc.createElement("reference");
      eRef.setAttribute("name", parentType);
      eRef.setAttribute("assetIDs", parentId);
      eAsset.appendChild(eRef);
    }
    this._doc.getElementsByTagName("assets").item(0).appendChild(eAsset);
  }

  /**
   * Adds a flow to the flow XML
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getEntryFlows
   * @see module:ibm-igc-lineage~FlowHandler#getExitFlows
   * @see module:ibm-igc-lineage~FlowHandler#getSystemFlows
   * @param {FlowList} flowsSection - the flows area into which to add the flow
   * @param {Flow} [existingFlow] - an existing flow to update or replace
   * @param {string} sourceIDs - the sourceIDs to use in the flow mapping
   * @param {string} targetIDs - the targetIDs to use in the flow mapping
   * @param {string} comment - the comment to add to the flow mapping
   * @param {boolean} bReplace - true if any existing flow should be replaced, false if the mappings should be appended
   */
  addFlow(flowsSection, existingFlow, sourceIDs, targetIDs, comment, bReplace) {
    if (typeof existingFlow === 'undefined' || existingFlow === null) {
      const eMapping = this._doc.createElement("flow");
      eMapping.setAttribute("sourceIDs", sourceIDs);
      eMapping.setAttribute("targetIDs", targetIDs);
      eMapping.setAttribute("comment", comment);
      flowsSection.getElementsByTagName("subFlows").item(0).appendChild(eMapping);
    } else {
      const sExistingTargets = existingFlow.getAttribute("targetIDs");
      const sExistingComment = existingFlow.getAttribute("comment");
      if (bReplace) {
        existingFlow.setAttribute("targetIDs", targetIDs);
        existingFlow.setAttribute("comment", comment);
      } else {
        existingFlow.setAttribute("targetIDs", sExistingTargets + " " + targetIDs);
        existingFlow.setAttribute("comment", sExistingComment + " and " + comment);
      }
    }
  }

  /**
   * Retrieves the flow XML, including any modifications that have been made (added assets, flows)
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#addAsset
   * @see module:ibm-igc-lineage~FlowHandler#addFlow
   * @returns {string} the full XML of the flow document
   */
  getCustomisedXML() {
    return new xmldom.XMLSerializer().serializeToString(this._doc);
  }

}

module.exports = FlowHandler;
