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

const xmldom = require('xmldom');
const xpath = require('xpath');
var select = xpath.useNamespaces({"flowdoc": "http://www.ibm.com/iis/flow-doc"});

/**
 * @namespace
 */
function FlowHandler() {};
FlowHandler.prototype = {

  doc: null,
  xmlOriginal: "",
  eProject: null,
  eJob: null,
  select: select,

  /**
   * Parses an XML flow document
   *
   * @function
   * @param {string} xml
   */
  parseXML: function(xml) {
    this.xmlOriginal = xml;
    this.doc = new xmldom.DOMParser().parseFromString(xml);
    eProject = this.getAssetByClass("DataStageX.DSProject");
    eJob = this.getAssetByClass("DataStageX.x_JOB_PARALLEL");
  },

  /**
   * @private
   */
  _getElementsByContext: function(expression, context) {
    return select(expression, context);
  },
  /**
   * @private
   */
  _getElementByContext: function(expression, context) {
    return this._getElementsByContext(expression, context)[0];
  },
  getElements: function(expression) {
    return this._getElementsByContext(expression, this.doc);
  },
  getElement: function(expression) {
    return this.getElements(expression)[0];
  },
  /**
   * Gets the name of an asset
   *
   * @function
   * @param {Asset} asset
   * @returns {string}
   */
  getAssetName: function(asset) {
    return asset.getAttribute("repr");
  },
  /**
   * Gets the RID of an asset
   *
   * @function
   * @param {Asset} asset
   * @returns {string}
   */
  getAssetRID: function(asset) {
    return asset.getAttribute("externalID");
  },
  /**
   * @private
   */
  getAssetByClass: function(className) {
    return this.getElement("/flowdoc:doc/flowdoc:assets/flowdoc:asset[@class='" + className + "']");
  },
  /**
   * Gets an asset by its unique flow XML ID (not RID)
   *
   * @function
   * @param {string} id
   * @returns {Asset}
   */
  getAssetById: function(id) {
    return this.getElement("/flowdoc:doc/flowdoc:assets/flowdoc:asset[@ID='" + id + "']");
  },
  /**
   * Gets the name of an asset based on its unique flow XML ID (not RID)
   *
   * @function
   * @param {string} id
   * @returns {string}
   */
  getAssetNameById: function(id) {
    return this.getAssetName(this.getAssetById(id));
  },

  /**
   * Gets the Transformation Project details
   *
   * @function
   * @returns {Asset}
   */
  getProjectNode: function() {
    return eProject;
  },
  /**
   * Gets the Job details
   *
   * @function
   * @returns {Asset}
   */
  getJobNode: function() {
    return eJob;
  },
  /**
   * Gets the details for ENTRY flows (data store-to-DataStage)
   *
   * @function
   * @returns {FlowList}
   */
  getEntryFlows: function() {
    return this.getElement("/flowdoc:doc/flowdoc:flowUnits/flowdoc:flowUnit/flowdoc:subFlows[@reuseType='ENTRY']");
  },
  /**
   * Gets the details for EXIT flows (DataStage-to-data store)
   *
   * @function
   * @returns {FlowList}
   */
  getExitFlows: function() {
    return this.getElement("/flowdoc:doc/flowdoc:flowUnits/flowdoc:flowUnit/flowdoc:subFlows[@reuseType='EXIT']");
  },
  /**
   * Gets the details for INSIDE flows (DataStage-to-DataStage)
   *
   * @function
   * @returns {FlowList}
   */
  getSystemFlows: function() {
    return this.getElement("/flowdoc:doc/flowdoc:flowUnits/flowdoc:flowUnit/flowdoc:subFlows[@flowType='SYSTEM']");
  },

  /**
   * Gets all of the subflows from a set of flows
   *
   * @function
   * @param {FlowList} flows - the set of flows for which to get subflows
   * @returns {FlowList} the subflows
   */
  getSubflows: function(flows) {
    return this._getElementsByContext("flowdoc:subFlows/flowdoc:flow", flows);
  },
  /**
   * Gets a specific subflow based on its source
   *
   * @function
   * @param {FlowList} flows - the set of flows from which to get the subflow
   * @param {string} sourceId - the sourceID of the subflow
   * @returns {Flow} the subflow
   */
  getSubflowBySourceId: function(flows, sourceId) {
    return this._getElementByContext("flowdoc:subFlows/flowdoc:flow[@sourceIDs='" + sourceId + "']", flows);
  },
  /**
   * Gets a specific subflow based on its target
   *
   * @function
   * @param {FlowList} flows - the set of flows from which to get the subflow
   * @param {string} targetId - the targetID of the subflow
   * @returns {Flow} the subflow
   */
  getSubflowsByTargetId: function(flows, targetId) {
    return this._getElementsByContext("flowdoc:subFlows/flowdoc:flow[@targetIDs='" + targetId + "']", flows);
  },
  /**
   * Gets the ID of the parent (reference) of the provided asset
   *
   * @function
   * @param {Asset} asset
   * @returns {string}
   */
  getParentAssetId: function(asset) {
    return this._getElementByContext("flowdoc:reference", asset).getAttribute("assetIDs");
  },

  /**
   * Gets the ID of the source repository that is mapped to the provided DataStage target
   *
   * @function
   * @see getEntryFlows
   * @param {FlowList} entryFlows - the set of ENTRY flows
   * @param {string} DSSourceId - the DataStage target (targetID) of the ENTRY flow
   * @returns {string} the mapped source repository (sourceID) of the ENTRY flow
   */
  getRepositoryIdFromDSSourceId: function(entryFlows, DSSourceId) {
    var element = this._getElementByContext("flowdoc:subFlows/flowdoc:flow[@targetIDs='" + DSSourceId + "']", entryFlows);
    if (element != null) {
      return element.getAttribute("sourceIDs");
    } else {
      return null;
    }
  },
  /**
   * Gets the ID of the target repository that is mapped from the provided DataStage source
   *
   * @function
   * @see getExitFlows
   * @param {FlowList} exitFlows - the set of EXIT flows
   * @param {string} DSTargetId - the DataStage source (sourceID) of the EXIT flow
   * @returns {string} the mapped target repository (targetID) of the EXIT flow
   */
  getRepositoryIdFromDSTargetId: function(exitFlows, DSTargetId) {
    var element = this._getElementByContext("flowdoc:subFlows/flowdoc:flow[@sourceIDs='" + DSTargetId + "']", exitFlows);
    if (element != null) {
      return element.getAttribute("targetIDs");
    } else {
      return null;
    }
  },

  /**
   * Gets the identity string (externalID) for the provided database table
   *
   * @function
   * @see getParentAssetId
   * @param {string} tblName - the name of the database table
   * @param {string} schemaId - the ID of the parent database schema
   * @returns {string}
   */
  getTableIdentity: function(tblName, schemaId) {
    var eSchema = this.getAssetById(schemaId);
    var schemaName = this.getAssetName(eSchema);
    var dcnId = this.getParentAssetId(eSchema);
    var eDCN = this.getAssetById(dcnId);
    var dcnName = this.getAssetName(eDCN);
    var creationTool = this._getElementByContext("flowdoc:attribute[@name='creationTool']", eDCN).getAttribute("value");
    var hostId = this.getParentAssetId(eDCN);
    var eHost = this.getAssetById(hostId);
    var hostName = this.getAssetName(eHost);
    return "_ngo:table:"
      + "_ngo:db:" + hostName.toLowerCase()
      + "::" + dcnName.toLowerCase()
      + "::" + creationTool.toLowerCase()
      + "::" + schemaName.toLowerCase()
      + "::" + tblName.toLowerCase();
  },
  /**
   * Gets the identity string (externalID) for the provided database column
   *
   * @function
   * @see getParentAssetId
   * @param {string} colName - the name of the database column
   * @param {string} tableId - the ID of the parent database table
   * @returns {string}
   */
  getColumnIdentity: function(colName, tableId) {
    var eTable = this.getAssetById(tableId);
    var tableName = this.getAssetName(eTable);
    var schemaId = this.getParentAssetId(eTable);
    var tableIdentity = this.getTableIdentity(tableName, schemaId);
    return "_ngo:"
      + colName.toLowerCase()
      + tableIdentity.replace("_ngo:table:", "::");
  },
  /**
   * Gets the database column identity string (externalID) from an existing database table identity string
   *
   * @function
   * @see getTableIdentity
   * @param {string} colName - the name of the database column
   * @param {string} tableIdentity - the identity string (externalID) of the parent database table
   * @returns {string}
   */
  getColumnIdentityFromTableIdentity: function(colName, tableIdentity) {
    return "_ngo:"
      + colName.toLowerCase()
      + tableIdentity.replace("_ngo:table:", "::");
  },

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
   * @param {string} parentType - the classname of the asset's parent data type (e.g. ASCLModel.DatabaseTable)
   * @param {string} parentId - the unique ID of the asset's parent within the XML flow document
   */
  addAsset: function(className, name, rid, xmlId, matchByName, virtualOnly, parentType, parentId) {
    var eAsset = this.doc.createElement("asset");
    eAsset.setAttribute("class", className);
    eAsset.setAttribute("repr", name);
    eAsset.setAttribute("externalID", rid);
    eAsset.setAttribute("ID", xmlId);
    eAsset.setAttribute("matchByName", matchByName);
    eAsset.setAttribute("virtualOnly", virtualOnly);
    var eAttr = this.doc.createElement("attribute");
    eAttr.setAttribute("name", "name");
    eAttr.setAttribute("value", name);
    eAsset.appendChild(eAttr);
    var eRef = this.doc.createElement("reference");
    eRef.setAttribute("name", parentType);
    eRef.setAttribute("assetIDs", parentId);
    eAsset.appendChild(eRef);
    this.doc.getElementsByTagName("assets").item(0).appendChild(eAsset);
  },
  /**
   * Adds a flow to the flow XML
   *
   * @function
   * @see getEntryFlows
   * @see getExitFlows
   * @see getSystemFlows
   * @param {FlowList} flowsSection - the flows area into which to add the flow
   * @param {Flow} existingFlow - an existing flow to update or replace
   * @param {string} sourceIDs - the sourceIDs to use in the flow mapping
   * @param {string} targetIDs - the targetIDs to use in the flow mapping
   * @param {string} comment - the comment to add to the flow mapping
   * @param {boolean} bReplace - true if any existing flow should be replaced, false if the mappings should be appended
   */
  addFlow: function(flowsSection, existingFlow, sourceIDs, targetIDs, comment, bReplace) {
    if (existingFlow == null) {
      var eMapping = this.doc.createElement("flow");
      eMapping.setAttribute("sourceIDs", sourceIDs);
      eMapping.setAttribute("targetIDs", targetIDs);
      eMapping.setAttribute("comment", comment);
      flowsSection.getElementsByTagName("subFlows").item(0).appendChild(eMapping);
    } else {
      var sExistingTargets = existingFlow.getAttribute("targetIDs");
      var sExistingComment = existingFlow.getAttribute("comment");
      if (bReplace) {
        existingFlow.setAttribute("targetIDs", targetIDs);
        existingFlow.setAttribute("comment", comment);
      } else {
        existingFlow.setAttribute("targetIDs", sExistingTargets + " " + targetIDs);
        existingFlow.setAttribute("comment", sExistingComment + " and " + comment);
      }
    }
  },

  /**
   * Retrieves the flow XML, including any modifications that have been made (added assets, flows)
   *
   * @function
   * @see addAsset
   * @see addFlow
   * @returns {string} the full XML of the flow document
   */
  getCustomisedXML: function() {
    return new xmldom.XMLSerializer().serializeToString(this.doc);
  }

};

if (typeof require == 'function') {
  exports.FlowHandler = FlowHandler;
}
