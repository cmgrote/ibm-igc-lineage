# README

Consists of the following functionality:

-   Node.js module for interacting with lineage (documentation below)
-   Generic lineage flow extension hook (see documentation under `src/com/ibm/iis/gov/services/README.md`)
-   Sample code for producing extended lineage (see documentation under `samples/README.md`)

# Node.js module

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

## ibm-igc-lineage

Re-usable functions for handling lineage flow documents (XML) and operational metadata (OMD XML)

**Meta**

-   **license**: Apache-2.0

## FlowHandler

FlowHandler class -- for handling IGC Flow Documents (XML)

**Examples**

```javascript
// parses an XML flow document held in 'xmlString' as a string
var igclineage = require('ibm-igc-lineage');
var fh = new igclineage.FlowHandler();
fh.parseXML(xmlString);
```

### parseXML

Parses an XML flow document

**Parameters**

-   `xml` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getAssetName

Gets the name of an asset

**Parameters**

-   `asset` **Asset** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getAssetRID

Gets the RID of an asset

**Parameters**

-   `asset` **Asset** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getAssetById

Gets an asset by its unique flow XML ID (not RID)

**Parameters**

-   `id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **Asset** 

### getAssetNameById

Gets the name of an asset based on its unique flow XML ID (not RID)

**Parameters**

-   `id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getProjectNode

Gets the Transformation Project details

Returns **Asset** 

### getJobNode

Gets the Job details

Returns **Asset** 

### getEntryFlows

Gets the details for ENTRY flows (data store-to-DataStage)

Returns **FlowList** 

### getExitFlows

Gets the details for EXIT flows (DataStage-to-data store)

Returns **FlowList** 

### getSystemFlows

Gets the details for INSIDE flows (DataStage-to-DataStage)

Returns **FlowList** 

### getSubflows

Gets all of the subflows from a set of flows

**Parameters**

-   `flows` **FlowList** the set of flows for which to get subflows

Returns **FlowList** the subflows

### getSubflowBySourceId

Gets a specific subflow based on its source

**Parameters**

-   `flows` **FlowList** the set of flows from which to get the subflow
-   `sourceId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the sourceID of the subflow

Returns **Flow** the subflow

### getSubflowsByTargetId

Gets a specific subflow based on its target

**Parameters**

-   `flows` **FlowList** the set of flows from which to get the subflow
-   `targetId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the targetID of the subflow

Returns **Flow** the subflow

### getParentAssetId

Gets the ID of the parent (reference) of the provided asset

**Parameters**

-   `asset` **Asset** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getRepositoryIdFromDSSourceId

Gets the ID of the source repository that is mapped to the provided DataStage target

**Parameters**

-   `entryFlows` **FlowList** the set of ENTRY flows
-   `DSSourceId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the DataStage target (targetID) of the ENTRY flow

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the mapped source repository (sourceID) of the ENTRY flow

### getRepositoryIdFromDSTargetId

Gets the ID of the target repository that is mapped from the provided DataStage source

**Parameters**

-   `exitFlows` **FlowList** the set of EXIT flows
-   `DSTargetId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the DataStage source (sourceID) of the EXIT flow

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the mapped target repository (targetID) of the EXIT flow

### getTableIdentity

Gets the identity string (externalID) for the provided database table

**Parameters**

-   `tblName` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the name of the database table
-   `schemaId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the ID of the parent database schema

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getColumnIdentity

Gets the identity string (externalID) for the provided database column

**Parameters**

-   `colName` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the name of the database column
-   `tableId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the ID of the parent database table

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getColumnIdentityFromTableIdentity

Gets the database column identity string (externalID) from an existing database table identity string

**Parameters**

-   `colName` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the name of the database column
-   `tableIdentity` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the identity string (externalID) of the parent database table

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### addAsset

Adds an asset to the flow XML

**Parameters**

-   `className` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the classname of the data type of the asset (e.g. ASCLModel.DatabaseField)
-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the name of the asset
-   `rid` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the RID of the asset, or a virtual identity (externalID)
-   `xmlId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the unique ID of the asset within the XML flow document
-   `matchByName` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** should be one of ['true', 'false']
-   `virtualOnly` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** should be one of ['true', 'false']
-   `parentType` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the classname of the asset's parent data type (e.g. ASCLModel.DatabaseTable)
-   `parentId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the unique ID of the asset's parent within the XML flow document

### addFlow

Adds a flow to the flow XML

**Parameters**

-   `flowsSection` **FlowList** the flows area into which to add the flow
-   `existingFlow` **Flow** an existing flow to update or replace
-   `sourceIDs` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the sourceIDs to use in the flow mapping
-   `targetIDs` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the targetIDs to use in the flow mapping
-   `comment` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the comment to add to the flow mapping
-   `bReplace` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** true if any existing flow should be replaced, false if the mappings should be appended

### getCustomisedXML

Retrieves the flow XML, including any modifications that have been made (added assets, flows)

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the full XML of the flow document

## OMDHandler

OMDHandler class -- for handling IGC run-time, operational metadata documents (OMD XML)

**Examples**

```javascript
// parses an operational metadata XML document held in 'xmlString' as a string
var igclineage = require('ibm-igc-lineage');
var omd = new igclineage.OMDHandler();
omd.parseOMD(xmlString);
```

### parseOMD

Parses an Operational Metadata (OMD) flow document

**Parameters**

-   `flow` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getRunMessage

Gets the information message resulting from the execution of the job that produced this operational metadata

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getRunStatus

Gets the status code from the execution of the job that produced this operational metadata

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getDesign

Gets the details for the operational metadata job's design

Returns **SoftwareResourceLocator** 

### getExecutable

Gets the details for the operational metadata job's executable

Returns **SoftwareResourceLocator** 

### getReadEvent

Gets the details for OMD Read Event (data movement)

Returns **[Event](https://developer.mozilla.org/en-US/docs/Web/API/Event)** 

### getWriteEvent

Gets the details for OMD Write Event (data movement)

Returns **[Event](https://developer.mozilla.org/en-US/docs/Web/API/Event)** 

### getRowCount

Gets the number of records processed by the event

**Parameters**

-   `e` **[Event](https://developer.mozilla.org/en-US/docs/Web/API/Event)** 

Returns **int** 

### getDataResourceForEvent

Gets the data resource (table-level details) processed by the event

**Parameters**

-   `e` **[Event](https://developer.mozilla.org/en-US/docs/Web/API/Event)** 

Returns **DataResourceLocator** 

### getDataCollectionForEvent

Gets the data collection (column-level details) processed by the event

**Parameters**

-   `e` **[Event](https://developer.mozilla.org/en-US/docs/Web/API/Event)** 

Returns **DataCollection** 

### getDataResourceHost

Gets the hostname of the data resource

**Parameters**

-   `dataResource` **DataResourceLocator** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getDataResourceStore

Gets the data store name of the data resource

**Parameters**

-   `dataResource` **DataResourceLocator** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getDataResourceSchema

Gets the schema of the data resource

**Parameters**

-   `dataResource` **DataResourceLocator** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getDataResourceTable

Gets the table name of the data resource

**Parameters**

-   `dataResource` **DataResourceLocator** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getDataResourceIdentity

Gets the full identity string (::-delimited) of the data resource

**Parameters**

-   `dataResource` **DataResourceLocator** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### getDataCollectionColumns

Gets an array of all column names within the data collection

**Parameters**

-   `dataCollection` **DataCollection** 

Returns **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)>** 

### replaceHostname

Replaces the hostname in the operational metadata everywhere, making it loadable in a target environment

**Parameters**

-   `targetHostname` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the engine tier hostname of the target environment (where the operational metadata is to be loaded)

### getUniqueRuntimeIdentity

Returns a unique identity object for the runtime information received; specifically a set of unique parameters
as could be used to uniquely identify an object in IGC's lineage

Returns **any** Object

### getCustomisedOMD

Retrieves the operational metadata XML, including any modifications that have been made (i.e. replaced hostnames)

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** the full XML of the operational metadata
