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

const FlowHandler = require('./classes/flow-handler');
const OMDHandler = require('./classes/omd-handler');
const LineageWorkbook = require('./classes/lineage-workbook');

/**
 * Re-usable functions for handling lineage flow documents (XML) and operational metadata (OMD XML)
 * @module ibm-igc-lineage
 * @license Apache-2.0
 * @requires xmldom
 * @requires xpath
 */
const Lineage = (function() {



  return {
    
  };

})();

module.exports = Lineage;

if (typeof require === 'function') {
  module.exports.FlowHandler = FlowHandler;
  module.exports.OMDHandler = OMDHandler;
  module.exports.LineageWorkbook = LineageWorkbook;
}
