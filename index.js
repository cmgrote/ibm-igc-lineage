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
 * @file Re-usable functions for handling lineage flow documents (XML) and operational metadata (OMD XML)
 * @license Apache-2.0
 * @requires xmldom
 * @requires xpath
 * @example
 * // parses an XML flow document held in 'xmlString' as a string
 * var igclineage = require('ibm-igc-lineage');
 * var fh = new igclineage.FlowHandler();
 * fh.parseXML(xmlString);
  * @example
 * // parses an operational metadata XML document held in 'xmlString' as a string
 * var igclineage = require('ibm-igc-lineage');
 * var omd = new igclineage.OMDHandler();
 * omd.parseOMD(xmlString);
 */

/**
 * @module ibm-igc-lineage
 */

const xmldom = require('xmldom');
const xpath = require('xpath');
const selectFlowDoc = xpath.useNamespaces({"flowdoc": "http://www.ibm.com/iis/flow-doc"});

/**
 * @namespace
 */
function FlowHandler() {}
FlowHandler.prototype = {

  doc: null,
  xmlOriginal: "",
  eProject: null,
  eJob: null,
  select: selectFlowDoc,

  /**
   * Parses an XML flow document
   *
   * @function
   * @param {string} xml
   */
  parseXML: function(xml) {
    this.xmlOriginal = xml;
    this.doc = new xmldom.DOMParser().parseFromString(xml);
    this.eProject = this.getAssetByClass("DataStageX.DSProject");
    this.eJob = this.getAssetByClass("DataStageX.x_JOB_PARALLEL");
  },

  /**
   * @private
   */
  _getElementsByContext: function(expression, context) {
    return this.select(expression, context);
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
    return this.eProject;
  },
  /**
   * Gets the Job details
   *
   * @function
   * @returns {Asset}
   */
  getJobNode: function() {
    return this.eJob;
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
   * @see module:ibm-igc-lineage~FlowHandler#getEntryFlows
   * @param {FlowList} entryFlows - the set of ENTRY flows
   * @param {string} DSSourceId - the DataStage target (targetID) of the ENTRY flow
   * @returns {string} the mapped source repository (sourceID) of the ENTRY flow
   */
  getRepositoryIdFromDSSourceId: function(entryFlows, DSSourceId) {
    const element = this._getElementByContext("flowdoc:subFlows/flowdoc:flow[@targetIDs='" + DSSourceId + "']", entryFlows);
    if (element !== null) {
      return element.getAttribute("sourceIDs");
    } else {
      return null;
    }
  },
  /**
   * Gets the ID of the target repository that is mapped from the provided DataStage source
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getExitFlows
   * @param {FlowList} exitFlows - the set of EXIT flows
   * @param {string} DSTargetId - the DataStage source (sourceID) of the EXIT flow
   * @returns {string} the mapped target repository (targetID) of the EXIT flow
   */
  getRepositoryIdFromDSTargetId: function(exitFlows, DSTargetId) {
    const element = this._getElementByContext("flowdoc:subFlows/flowdoc:flow[@sourceIDs='" + DSTargetId + "']", exitFlows);
    if (element !== null) {
      return element.getAttribute("targetIDs");
    } else {
      return null;
    }
  },

  /**
   * Gets the identity string (externalID) for the provided database table
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getParentAssetId
   * @param {string} tblName - the name of the database table
   * @param {string} schemaId - the ID of the parent database schema
   * @returns {string}
   */
  getTableIdentity: function(tblName, schemaId) {
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
  },
  /**
   * Gets the identity string (externalID) for the provided database column
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getParentAssetId
   * @param {string} colName - the name of the database column
   * @param {string} tableId - the ID of the parent database table
   * @returns {string}
   */
  getColumnIdentity: function(colName, tableId) {
    const eTable = this.getAssetById(tableId);
    const tableName = this.getAssetName(eTable);
    const schemaId = this.getParentAssetId(eTable);
    const tableIdentity = this.getTableIdentity(tableName, schemaId);
    return "_ngo:" +
      colName.toLowerCase() +
      tableIdentity.replace("_ngo:table:", "::");
  },
  /**
   * Gets the database column identity string (externalID) from an existing database table identity string
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getTableIdentity
   * @param {string} colName - the name of the database column
   * @param {string} tableIdentity - the identity string (externalID) of the parent database table
   * @returns {string}
   */
  getColumnIdentityFromTableIdentity: function(colName, tableIdentity) {
    return "_ngo:" +
      colName.toLowerCase() +
      tableIdentity.replace("_ngo:table:", "::");
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
    const eAsset = this.doc.createElement("asset");
    eAsset.setAttribute("class", className);
    eAsset.setAttribute("repr", name);
    eAsset.setAttribute("externalID", rid);
    eAsset.setAttribute("ID", xmlId);
    eAsset.setAttribute("matchByName", matchByName);
    eAsset.setAttribute("virtualOnly", virtualOnly);
    const eAttr = this.doc.createElement("attribute");
    eAttr.setAttribute("name", "name");
    eAttr.setAttribute("value", name);
    eAsset.appendChild(eAttr);
    const eRef = this.doc.createElement("reference");
    eRef.setAttribute("name", parentType);
    eRef.setAttribute("assetIDs", parentId);
    eAsset.appendChild(eRef);
    this.doc.getElementsByTagName("assets").item(0).appendChild(eAsset);
  },
  /**
   * Adds a flow to the flow XML
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#getEntryFlows
   * @see module:ibm-igc-lineage~FlowHandler#getExitFlows
   * @see module:ibm-igc-lineage~FlowHandler#getSystemFlows
   * @param {FlowList} flowsSection - the flows area into which to add the flow
   * @param {Flow} existingFlow - an existing flow to update or replace
   * @param {string} sourceIDs - the sourceIDs to use in the flow mapping
   * @param {string} targetIDs - the targetIDs to use in the flow mapping
   * @param {string} comment - the comment to add to the flow mapping
   * @param {boolean} bReplace - true if any existing flow should be replaced, false if the mappings should be appended
   */
  addFlow: function(flowsSection, existingFlow, sourceIDs, targetIDs, comment, bReplace) {
    if (existingFlow === null) {
      const eMapping = this.doc.createElement("flow");
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
  },

  /**
   * Retrieves the flow XML, including any modifications that have been made (added assets, flows)
   *
   * @function
   * @see module:ibm-igc-lineage~FlowHandler#addAsset
   * @see module:ibm-igc-lineage~FlowHandler#addFlow
   * @returns {string} the full XML of the flow document
   */
  getCustomisedXML: function() {
    return new xmldom.XMLSerializer().serializeToString(this.doc);
  }

};

/**
 * @namespace
 */
function OMDHandler() {}
OMDHandler.prototype = {
  
  doc: null,
  omdOriginal: "",
  runStatus: "",
  runMessage: "",

  /**
   * Parses an Operational Metadata (OMD) flow document
   *
   * @function
   * @param {string} flow
   */
  parseOMD: function(flow) {
    this.omdOriginal = flow;
    this.doc = new xmldom.DOMParser().parseFromString(flow);
    this.runStatus = this._getAttributeByContext("/Run/@StatusCode", this.doc);
    this.runMessage = this._getAttributeByContext("/Run/@Message", this.doc);
  },

  /**
   * @private
   */
  _getElementsByContext: function(expression, context) {
    return xpath.select(expression, context);
  },
  /**
   * @private
   */
  _getElementByContext: function(expression, context) {
    return this._getElementsByContext(expression, context)[0];
  },
  /**
   * @private
   */
  _getAttributeByContext: function(attrExpression, context) {
    return xpath.select1(attrExpression, context).value;
  },
  getElements: function(expression) {
    return this._getElementsByContext(expression, this.doc);
  },
  getElement: function(expression) {
    return this.getElements(expression)[0];
  },
  /**
   * Gets the information message resulting from the execution of the job that produced this operational metadata
   *
   * @function
   * @returns {string}
   */
  getRunMessage: function() {
    return this.runMessage;
  },
  /**
   * Gets the status code from the execution of the job that produced this operational metadata
   *
   * @function
   * @returns {string}
   */
  getRunStatus: function() {
    return this.runStatus;
  },
  /**
   * Gets the details for the operational metadata job's design
   *
   * @function
   * @returns {SoftwareResourceLocator}
   */
  getDesign: function() {
    return this.getElement("/Run/Design/SoftwareResourceLocator");
  },
  /**
   * Gets the details for the operational metadata job's executable
   *
   * @function
   * @returns {SoftwareResourceLocator}
   */
  getExecutable: function() {
    return this.getElement("/Run/Deployment/SoftwareResourceLocator");
  },
  /**
   * Gets the details for OMD Read Event (data movement)
   *
   * @function
   * @returns {Event}
   */
  getReadEvent: function() {
    return this.getElement("/Run/Events/Event[@Type='Read']");
  },
  /**
   * Gets the details for OMD Write Event (data movement)
   *
   * @function
   * @returns {Event}
   */
  getWriteEvent: function() {
    return this.getElement("/Run/Events/Event[@Type='Write']");
  },
  /**
   * Gets the number of records processed by the event
   *
   * @function
   * @param {Event} e
   * @returns {int}
   */
  getRowCount: function(e) {
    return parseInt(this._getAttributeByContext("@RowCount", e));
  },

  /**
   * Gets the data resource (table-level details) processed by the event
   *
   * @function
   * @param {Event} e
   * @returns {DataResourceLocator}
   */
  getDataResourceForEvent: function(e) {
    return this._getElementByContext("DataResourceLocator", e);
  },
  /**
   * Gets the data collection (column-level details) processed by the event
   *
   * @function
   * @param {Event} e
   * @returns {DataCollection}
   */
  getDataCollectionForEvent: function(e) {
    const refDC = this._getAttributeByContext("SoftwareResourceLocator/@ReferenceDC", e);
    return this.getElement("/Run/DataSchema/DataCollection[@Ident='" + refDC + "']");
  },

  /**
   * Gets the hostname of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceHost: function(dataResource) {
    return this._getAttributeByContext("@Name", this._getElementByContext("LocatorComponent[@Class='Computer']", dataResource));
  },
  /**
   * Gets the data store name of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceStore: function(dataResource) {
    return this._getAttributeByContext("@Name", this._getElementByContext("LocatorComponent[@Class='DataStore']", dataResource));
  },
  /**
   * Gets the schema of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceSchema: function(dataResource) {
    return this._getAttributeByContext("@Name", this._getElementByContext("LocatorComponent[@Class='DataSchema']", dataResource));
  },
  /**
   * Gets the table name of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceTable: function(dataResource) {
    return this._getAttributeByContext("@Name", this._getElementByContext("LocatorComponent[@SubClass='Table']", dataResource));
  },
  /**
   * Gets the full identity string (/-delimited) of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceIdentity: function(dataResource) {
    const host = this.getDataResourceHost(dataResource);
    const store = this.getDataResourceStore(dataResource);
    const schema = this.getDataResourceSchema(dataResource);
    const table = this.getDataResourceTable(dataResource);
    return host + "/" + store + "/" + schema + "/" + table;
  },

  /**
   * Gets an array of all column names within the data collection
   *
   * @function
   * @param {DataCollection} dataCollection
   * @returns {string[]}
   */
  getDataCollectionColumns: function(dataCollection) {
    const eFields = this._getElementsByContext("DataField", dataCollection);
    const aFields = [];
    for (let i = 0; i < eFields.length; i++) {
      const sColName = this._getAttributeByContext("@Name", eFields[i]);
      aFields.push(sColName);
    }
    return aFields;
  },

  /**
   * @private
   */
  _getHostElement: function(softwareResourceLocator) {
    return this._getElementByContext("LocatorComponent[@Class='Computer']", softwareResourceLocator);
  },
  /**
   * Replaces the hostname in the operational metadata everywhere, making it loadable in a target environment
   *
   * @function
   * @param {string} targetHostname - the engine tier hostname of the target environment (where the operational metadata is to be loaded)
   */
  replaceHostname: function(targetHostname) {
    
    const eDeployment = this.getExecutable();
    const eDeploymentHost = this._getHostElement(eDeployment);
    eDeploymentHost.setAttribute("Name", targetHostname);

    const elParameters = this.getElements("/Run/ActualParameters/ActualParameter");
    for (let i = 0; i < elParameters.length; i++) {
      const eParam = elParameters[i];
      const eParamHost = this._getHostElement(this._getElementByContext("SoftwareResourceLocator", eParam));
      const sFormalParameter = this._getAttributeByContext("@Name", this._getElementByContext("SoftwareResourceLocator/LocatorComponent[@Class='FormalParameter']", eParam));
      // If the parameter is for SourceConnectionString or TargetConnectionString, we'll pre-pend the parameter with the old hostname to create
      // a unique connection string (which we can then use in connection mapping for lineage purposes)
      if (sFormalParameter === "SourceConnectionString" || sFormalParameter === "TargetConnectionString") {
        const originalHost = this._getAttributeByContext("@Name", eParamHost);
        const sValue = this._getAttributeByContext("@Value", eParam);
        eParam.setAttribute("Value", originalHost + "__" + sValue);
      }
      eParamHost.setAttribute("Name", targetHostname);
    }

    const eReadEvent = this.getReadEvent();
    const eReadEventHost = this._getHostElement(this._getElementByContext("DataResourceLocator", eReadEvent));
    eReadEventHost.setAttribute("Name", targetHostname);

    const eWriteEvent = this.getWriteEvent();
    const eWriteEventHost = this._getHostElement(this._getElementByContext("DataResourceLocator", eWriteEvent));
    eWriteEventHost.setAttribute("Name", targetHostname);

  },

  /**
   * Retrieves the operational metadata XML, including any modifications that have been made (i.e. replaced hostnames)
   *
   * @function
   * @see module:ibm-igc-lineage~OMDHandler#replaceHostname
   * @returns {string} the full XML of the operational metadata
   */
  getCustomisedOMD: function() {
    return new xmldom.XMLSerializer().serializeToString(this.doc);
  }

};

if (typeof require === 'function') {
  exports.FlowHandler = FlowHandler;
  exports.OMDHandler = OMDHandler;
}
