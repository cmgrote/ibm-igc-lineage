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
package com.ibm.iis.gov.services;

import com.ibm.iis.gov.flow.tweak.FlowTweaker;
import com.ibm.iis.gov.flow.tweak.TweakableFlow;
import com.ibm.iis.gov.flow.tweak.TweakableFlow.Status;

import java.io.File;
import java.io.IOException;
import java.util.Properties;

import java.nio.file.*;
import java.nio.charset.*;

public class LineageCustomisationProvider implements FlowTweaker {

   private static String CUSTOM_XML_LOCATION = "/data/semanticLineage/mappedFlows/output/";
   private static String MAPPED_XML_LOCATION = "/data/semanticLineage/mappedFlows/source/";
   private static String ORIGINAL_XML_LOCATION = "/data/semanticLineage/originalFlows/";

   public LineageCustomisationProvider() { }

   public static void initProperties() throws IOException {
      Properties properties = new Properties();
      properties.load(LineageCustomisationProvider.class.getResourceAsStream("LineageCustomisationProvider.properties"));
      String basePath = properties.getProperty("CustomLineageBasePath");
      ORIGINAL_XML_LOCATION = basePath + properties.getProperty("OriginXML");
      if (Files.notExists(Paths.get(ORIGINAL_XML_LOCATION))) {
         throw new IOException("Original XML location does not exist: " + ORIGINAL_XML_LOCATION);
      }
      CUSTOM_XML_LOCATION = basePath + properties.getProperty("CustomXML");
      if (Files.notExists(Paths.get(CUSTOM_XML_LOCATION))) {
         throw new IOException("Custom XML location does not exist: " + CUSTOM_XML_LOCATION);
      }
      MAPPED_XML_LOCATION = basePath + properties.getProperty("MappedXML");
      if (Files.notExists(Paths.get(MAPPED_XML_LOCATION))) {
         throw new IOException("Mapped XML location does not exist: " + MAPPED_XML_LOCATION);
      }
   }

   static String getFlowFilename(FlowParser fp) {
      return fp.getProjectName() + "__" + fp.getJobName() + ".xml";
   }

   private void writeReceivedFlow(String sFilename, String xmlToWrite) throws IOException {
      System.out.println("... writing received XML to: " + ORIGINAL_XML_LOCATION + sFilename);
      Files.write(Paths.get(ORIGINAL_XML_LOCATION + sFilename), xmlToWrite.getBytes());
   }

   @Override
   public TweakableFlow getTweakedFlow(TweakableFlow originalFlow) {

      String origXml = originalFlow.getFlowXML();
      
      TweakableFlow tweakedFlow = new TweakableFlow();
      tweakedFlow.setStatus(Status.OK);
      tweakedFlow.setFlowXML(origXml);

      try {

         initProperties();

         FlowParser fp = new FlowParser(origXml);
         System.out.println("Detecting lineage for: " + fp.getProjectName() + "/" + fp.getJobName());
         String sFilename = getFlowFilename(fp);

         File fCustom = new File(CUSTOM_XML_LOCATION + sFilename);

         // Record the original (received) lineage
         writeReceivedFlow(sFilename, origXml);

         // If the customised file does not exist
         if ( !fCustom.exists() ) {
      
            // Add a note to the lineage flow indicating that it has not been specially handled / customised
            tweakedFlow.setStatus(Status.OK);
            tweakedFlow.setMessage("No customised lineage found for this job, default lineage retained.");
      
         } else { // the customised file does exist
            
            // Check for job changes
            File fMapped = new File(MAPPED_XML_LOCATION + sFilename);
            if ( !fMapped.exists() ) {
      
               // If there is no longer a mapping source to compare against, add a note to the lineage flow
               // indicating the job has changed and customisation may no longer be handled
               tweakedFlow.setStatus(Status.WARNING);
               tweakedFlow.setMessage("Found customised lineage, but not flow used for the mapping -- cannot detect if job has changed, retaining default lineage.");
      
            } else {
      
               // If there is a mapping, check that the source of that mapping is unchanged compared to the 
               // lineage flow we've received -- if unchanged, return custom flow; otherwise add a note
               // that the job has changed and return original flow
               String xmlMapped = fp.readFile(MAPPED_XML_LOCATION + sFilename, StandardCharsets.UTF_8);
               if (xmlMapped.equals(origXml)) {
                  tweakedFlow.setStatus(Status.OK);
                  tweakedFlow.setMessage("Found and used customised lineage.");
                  tweakedFlow.setFlowXML(fp.readFile(CUSTOM_XML_LOCATION + sFilename, StandardCharsets.UTF_8));
               } else {
                  tweakedFlow.setStatus(Status.WARNING);
                  tweakedFlow.setMessage("Found customised lineage, but flow has changed since mapping -- retaining default lineage.");
               }
      
            }
      
         }

      } catch (IOException ex) {
         tweakedFlow.setFlowXML(origXml);
         tweakedFlow.setStatus(Status.FAILURE);
         tweakedFlow.setMessage("Fatal problem occurred when attempting to find customised lineage.");
         ex.printStackTrace();
      }

      return tweakedFlow;

   }

}
