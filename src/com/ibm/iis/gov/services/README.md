# README

These classes provide a generic lineage flow extension hook-point, which works as follows:

1.	Records the default lineage produced by IGC
2.	Looks for any pre-defined customised lineage for that job, and returns this as the proper lineage if and only if the job has not changed since that customised lineage was produced
3.	Otherwise returns the default lineage produced by IGC with an appropriate status message

NOTE: This does *not* actually contain any logic for customising the lineage -- it provides only the very simple lookup logic described immediately above.  Actually customising or extending lineage can then be done asynchronously by any means desired, and the result of such customisation placed into the appropriate directory location to be automatically picked up by (2) above.

# Usage

By default (these locations can be modified in the `LineageCustomisationProvider.properties` file before bundling and deploying the jar file):

1.	For any job for which lineage is enabled, any time it is modified (e.g. imported, saved within DataStage, etc) this extension point will be called with the IGC-generated lineage for that job.
2.	The extension point will record this default IGC-produced lineage into `/data/semanticLineage/originalFlows/<projectName>__<jobName>.xml`.
3.	The extension point will then look for an XML file with the same name under `/data/semanticLineage/mappedFlows/output/`.

	-	If such an XML file is found, it will then look for the same XML file under `/data/semanticLineage/mappedFlows/source/`.  If this XML file matches the default IGC-produced lineage we know the job has not changed (with respect to lineage) and can continue to use the custom lineage in `/data/semanticLineage/mappedFlows/output/`.  If the XML file does *not* match the IGC-produced lineage, we must assume the job has changed since the custom lineage was created -- to be safe we therefore retain the IGC-produced lineage.
	-	If not found, the default IGC-produced lineage will be retained.

4. In all cases, an informational status message and code are left on the job indicating the outcome.

# Installation

## Pre-requisites

The lineage customisation mechanism is only available from Information Server v11.5, fixpack 1 with Governance Rollup 3 or greater. An Information Governance Catalog (“IGC”) component must be installed, at a minimum, at this level.

## Create the compiled bundle for the lineage flow extension hook-point

1.	Compile the Java source code here, including `gov-flow-tweak-extension.jar` in your classpath. For example:
	
	```
	# export JAVA_HOME=/opt/IBM/InformationServer/jdk # export PATH=$PATH:$JAVA_HOME/bin
	# cd com/company/lineage
	# javac -cp /opt/IBM/WebSphere/AppServer/profiles/InfoSphere/lib/iis/110gov/gov-flow-tweak-extension.jar *.java
	```

2.	Create a jar file that includes the compiled Java code from the step above. For example:
	
	```
	jar cvf custom-flows.jar com/*
	```

## Register the lineage flow extension hook-point

The following steps configure this basic hook-point:

1.	Copy the file `custom-flows.jar` to `/opt/IBM/WebSphere/AppServer/profiles/InfoSphere/lib/iis/110gov`.
2.	Ensure the jar file is readable by the user that runs WebSphere Application Server (in a default installation this would be root, but in a hardened environment may be another user).
3.	Run the following command on the domain (services) tier of Information Server:
	
	```
	# cd /opt/IBM/InformationServer/ASBServer/bin
	# ./iisAdmin.sh -set -key com.ibm.iis.gov.vr.setting.flowTweaker -value com.ibm.iis.gov.services.LineageCustomisationProvider
	```

4.	Create the following folders on the domain (services) tier of Information Server, again ensuring that they are owned and writable by the user that runs WebSphere Application Server: `/data/semanticLineage/originalFlows`, `/data/semanticLineage/mappedFlows/source`,  `/data/semanticLineage/mappedFlows/output`
5.	Restart WebSphere Application Server, or alternatively the entire Information Server stack.
