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
 * AssetTypeFactory class -- for encapsulating information about asset types
 */
class AssetTypeFactory {

  constructor() { }

  static getAssetsToExtract() {
    return [
      "Applications",
      "Files",
      "Databases",
      "Data Files"
    ];
  }

  static getDataAssetTypes() {
    return [
      "File",
      "Database",
      "Data File"
    ];
  }

  static getAssetTypeFromAssetName(assetName) {
    const assetNameToAssetType = {
      "Applications": "application",
      "Files": "file",
      "Databases": "database",
      "Data Files": "data_file"
    };
    if (!assetNameToAssetType.hasOwnProperty(assetName)) {
      throw new Error("Unable to find an asset named '" + assetName + "'.");
    }
    return assetNameToAssetType[assetName];
  }

  static getAssetParentTypeFromType(assetType) {
    const assetTypeToParentType = {
      "database": "host",
      "data_file": "host"
    };
    return (assetTypeToParentType.hasOwnProperty(assetType)) ? assetTypeToParentType[assetType] : null;
  }

  static getAssetProperties(assetType) {
    const assetTypeToProperties = {
      "application": {
        _name:                { displayName: "Name", isRequired: true },
        short_description:    { displayName: "Short Description", isRequired: false },
        long_description:     { displayName: "Long Description", isRequired: false }
      },
      "file": {
        _name:                { displayName: "Name", isRequired: true },
        short_description:    { displayName: "Short Description", isRequired: false },
        long_description:     { displayName: "Long Description", isRequired: false }
      },
      "database": {
        _id:                  { displayName: "RID", isRequired: true },
        _name:                { displayName: "Name", isRequired: true },
        "host.name":          { displayName: "Host", isRequired: true },
        short_description:    { displayName: "Short Description", isRequired: false },
        long_description:     { displayName: "Long Description", isRequired: false }
      },
      "data_file": {
        _id:                  { displayName: "RID", isRequired: true },
        _name:                { displayName: "Name", isRequired: true },
        "host.name":          { displayName: "Host", isRequired: true },
        path:                 { displayName: "Path", isRequired: true },
        short_description:    { displayName: "Short Description", isRequired: false },
        long_description:     { displayName: "Long Description", isRequired: false }
      }
    };
    if (!assetTypeToProperties.hasOwnProperty(assetType)) {
      throw new Error("Unable to find a asset type named '" + assetType + "'.");
    }
    return assetTypeToProperties[assetType];
  }

}

module.exports = AssetTypeFactory;
