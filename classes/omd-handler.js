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
 * OMDHandler class -- for handling IGC run-time, operational metadata documents (OMD XML)
 * @license Apache-2.0
 * @example
 * // parses an operational metadata XML document held in 'xmlString' as a string
 * var igclineage = require('ibm-igc-lineage');
 * var omd = new igclineage.OMDHandler();
 * omd.parseOMD(xmlString);
 */
class OMDHandler {

  constructor() {
    this._doc = null;
    this._omdOriginal = "";
    this._runStatus = "";
    this._runMessage = "";
  }

  /**
   * Parses an Operational Metadata (OMD) flow document
   *
   * @function
   * @param {string} flow
   */
  parseOMD(flow) {
    this._omdOriginal = flow;
    this._doc = new xmldom.DOMParser().parseFromString(flow);
    this._runStatus = this._getAttributeByContext("/Run/@StatusCode", this._doc);
    this._runMessage = this._getAttributeByContext("/Run/@Message", this._doc);
  }

  /**
   * @private
   */
  _getElementsByContext(expression, context) {
    return xpath.select(expression, context);
  }
  _getElementByContext(expression, context) {
    return this._getElementsByContext(expression, context)[0];
  }
  _getAttributeByContext(attrExpression, context) {
    return xpath.select1(attrExpression, context).value;
  }
  getElements(expression) {
    return this._getElementsByContext(expression, this._doc);
  }
  getElement(expression) {
    return this.getElements(expression)[0];
  }

  /**
   * Gets the information message resulting from the execution of the job that produced this operational metadata
   *
   * @function
   * @returns {string}
   */
  getRunMessage() {
    return this._runMessage;
  }

  /**
   * Gets the status code from the execution of the job that produced this operational metadata
   *
   * @function
   * @returns {string}
   */
  getRunStatus() {
    return this._runStatus;
  }

  /**
   * Gets the details for the operational metadata job's design
   *
   * @function
   * @returns {SoftwareResourceLocator}
   */
  getDesign() {
    return this.getElement("/Run/Design/SoftwareResourceLocator");
  }

  /**
   * Gets the details for the operational metadata job's executable
   *
   * @function
   * @returns {SoftwareResourceLocator}
   */
  getExecutable() {
    return this.getElement("/Run/Deployment/SoftwareResourceLocator");
  }

  /**
   * Gets the details for OMD Read Event (data movement)
   *
   * @function
   * @returns {Event}
   */
  getReadEvent() {
    return this.getElement("/Run/Events/Event[@Type='Read']");
  }

  /**
   * Gets the details for OMD Write Event (data movement)
   *
   * @function
   * @returns {Event}
   */
  getWriteEvent() {
    return this.getElement("/Run/Events/Event[@Type='Write']");
  }

  /**
   * Gets the number of records processed by the event
   *
   * @function
   * @param {Event} e
   * @returns {int}
   */
  getRowCount(e) {
    return parseInt(this._getAttributeByContext("@RowCount", e));
  }

  /**
   * Gets the data resource (table-level details) processed by the event
   *
   * @function
   * @param {Event} e
   * @returns {DataResourceLocator}
   */
  getDataResourceForEvent(e) {
    return this._getElementByContext("DataResourceLocator", e);
  }

  /**
   * Gets the data collection (column-level details) processed by the event
   *
   * @function
   * @param {Event} e
   * @returns {DataCollection}
   */
  getDataCollectionForEvent(e) {
    const refDC = this._getAttributeByContext("SoftwareResourceLocator/@ReferenceDC", e);
    return this.getElement("/Run/DataSchema/DataCollection[@Ident='" + refDC + "']");
  }

  /**
   * Gets the hostname of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceHost(dataResource) {
    return this._getAttributeByContext("@Name", this._getElementByContext("LocatorComponent[@Class='Computer']", dataResource));
  }

  /**
   * Gets the data store name of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceStore(dataResource) {
    return this._getAttributeByContext("@Name", this._getElementByContext("LocatorComponent[@Class='DataStore']", dataResource));
  }

  /**
   * Gets the schema of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceSchema(dataResource) {
    return this._getAttributeByContext("@Name", this._getElementByContext("LocatorComponent[@Class='DataSchema']", dataResource));
  }

  /**
   * Gets the table name of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceTable(dataResource) {
    return this._getAttributeByContext("@Name", this._getElementByContext("LocatorComponent[@SubClass='Table']", dataResource));
  }

  /**
   * Gets the full identity string (::-delimited) of the data resource
   *
   * @function
   * @param {DataResourceLocator} dataResource
   * @returns {string}
   */
  getDataResourceIdentity(dataResource) {
    const host = this.getDataResourceHost(dataResource);
    const store = this.getDataResourceStore(dataResource);
    const schema = this.getDataResourceSchema(dataResource);
    const table = this.getDataResourceTable(dataResource);
    return host + "::" + store + "::" + schema + "::" + table;
  }

  /**
   * Gets an array of all column names within the data collection
   *
   * @function
   * @param {DataCollection} dataCollection
   * @returns {string[]}
   */
  getDataCollectionColumns(dataCollection) {
    const eFields = this._getElementsByContext("DataField", dataCollection);
    const aFields = [];
    for (let i = 0; i < eFields.length; i++) {
      const sColName = this._getAttributeByContext("@Name", eFields[i]);
      aFields.push(sColName);
    }
    return aFields;
  }

  /**
   * @private
   */
  _getHostElement(softwareResourceLocator) {
    return this._getElementByContext("LocatorComponent[@Class='Computer']", softwareResourceLocator);
  }

  /**
   * Replaces the hostname in the operational metadata everywhere, making it loadable in a target environment
   *
   * @function
   * @param {string} targetHostname - the engine tier hostname of the target environment (where the operational metadata is to be loaded)
   */
  replaceHostname(targetHostname) {
    
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
      // NOTE: This seems to be a user-defined parameter name...  Will need to ensure everyone uses exactly the same name for this?
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

  }

  /**
   * Returns a unique identity object for the runtime information received; specifically a set of unique parameters
   * as could be used to uniquely identify an object in IGC's lineage
   *
   * @function
   * @returns Object
   */
  getUniqueRuntimeIdentity() {

    const idObj = {};

    // Pull project and job names from the Design information (otherwise we'll get a runtime name for the job, with a timestamp embedded in it)
    idObj.project = this._getAttributeByContext("@Name", this.getElement("/Run/Design/SoftwareResourceLocator/LocatorComponent[@SubClass='Project']"));
    idObj.job = this._getAttributeByContext("@Name", this.getElement("/Run/Design/SoftwareResourceLocator/LocatorComponent[@SubClass='Job']"));

    // Pull parameters from the runtime
    // TODO: should limit these to only lineage-relevant ones (eg ReadMode, RowsLimit will have no impact); but how to tell?
    // (Are any of them actually critical to lineage?)
    idObj.parameters = {};
    const elParameters = this.getElements("/Run/ActualParameters/ActualParameter");
    for (let i = 0; i < elParameters.length; i++) {
      const eParam = elParameters[i];
      const paramValue = this._getAttributeByContext("@Value", eParam);
      const paramName = this._getAttributeByContext("@Name", this._getElementByContext("SoftwareResourceLocator/LocatorComponent[@Class='FormalParameter']", eParam));
      idObj.parameters[paramName] = paramValue;
    }

    const eReadEvent = this.getReadEvent();
    const sourceIdentity = this.getDataResourceIdentity(this._getElementByContext("DataResourceLocator", eReadEvent));
    // Next line is to address the empty database name that seems to come back (NOTE: reliant on SourceConnectionString naming convention)
    idObj.source = sourceIdentity.replace(":: ::", "::" + idObj.parameters.SourceConnectionString + "::");
    const sourceId = this._getAttributeByContext("@ReferenceDC", this._getElementByContext("SoftwareResourceLocator", eReadEvent));
    const eSourceDC = this.getElement("/Run/DataSchema/DataCollection[@Ident='" + sourceId + "']");
    idObj.sourceColumns = this.getDataCollectionColumns(eSourceDC);

    const eWriteEvent = this.getWriteEvent();
    // Next line is to address the empty database name that seems to come back (NOTE: reliant on TargetConnectionString naming convention)
    const targetIdentity = this.getDataResourceIdentity(this._getElementByContext("DataResourceLocator", eWriteEvent));
    idObj.target = targetIdentity.replace(":: ::", "::" + idObj.parameters.TargetConnectionString + "::");
    const targetId = this._getAttributeByContext("@ReferenceDC", this._getElementByContext("SoftwareResourceLocator", eWriteEvent));
    const eTargetDC = this.getElement("/Run/DataSchema/DataCollection[@Ident='" + targetId + "']");
    idObj.targetColumns = this.getDataCollectionColumns(eTargetDC);

    return idObj;

  }

  /**
   * Retrieves the operational metadata XML, including any modifications that have been made (i.e. replaced hostnames)
   *
   * @function
   * @see module:ibm-igc-lineage~OMDHandler#replaceHostname
   * @returns {string} the full XML of the operational metadata
   */
  getCustomisedOMD() {
    return new xmldom.XMLSerializer().serializeToString(this._doc);
  }

}

module.exports = OMDHandler;
