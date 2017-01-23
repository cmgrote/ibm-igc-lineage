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

import java.io.*;
import java.nio.file.*;
import java.nio.charset.*;

import java.util.*;

import javax.xml.parsers.*;
import javax.xml.xpath.*;
import javax.xml.transform.*;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.dom.DOMSource;

import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.w3c.dom.Node;
import org.w3c.dom.Element;
import org.xml.sax.SAXException;

public class FlowParser {

   private String xmlOriginal = "";
   private DocumentBuilderFactory dbFactory = null;
   private DocumentBuilder dBuilder = null;
   private Document doc = null;
   private XPath xPath = null;
   private String sProjectName = "";
   private String sJobName = "";

   public String getProjectName() {
      return this.sProjectName;
   }
   public String getJobName() {
      return this.sJobName;
   }

   public static String readFile(String path, Charset encoding) throws IOException {
      byte[] encoded = Files.readAllBytes(Paths.get(path));
      return new String(encoded, encoding);
   }

   public Element getElement(String expression) throws IOException, XPathExpressionException {

      Element e = null;

      NodeList nodeList = (NodeList) xPath.compile(expression).evaluate(doc, XPathConstants.NODESET);
      for (int i = 0; i < nodeList.getLength(); i++) {
         Node nNode = nodeList.item(i);
         if (nNode.getNodeType() == Node.ELEMENT_NODE) {
            e = (Element) nNode;
         }
      }

      return e;

   }

   public Element getAssetByClass(String className) throws IOException, XPathExpressionException {
      return getElement("/doc/assets/asset[@class='" + className + "']");
   }

   public static String getAssetName(Element asset) {
      return asset.getAttribute("repr");
   }

   public FlowParser(String xml) {

      try {

         this.xmlOriginal = xml;
         this.dbFactory = DocumentBuilderFactory.newInstance();
         this.dBuilder = this.dbFactory.newDocumentBuilder();
         this.doc = dBuilder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
         this.doc.getDocumentElement().normalize();
         this.xPath = XPathFactory.newInstance().newXPath();

         this.sProjectName = getAssetName(getAssetByClass("DataStageX.DSProject"));
         this.sJobName = getAssetName(getAssetByClass("DataStageX.x_JOB_PARALLEL"));

      } catch (ParserConfigurationException e) {
         e.printStackTrace();
      } catch (SAXException e) {
         e.printStackTrace();
      } catch (IOException e) {
         e.printStackTrace();
      } catch (XPathExpressionException e) {
         e.printStackTrace();
      }

   }

}
