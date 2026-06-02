<?xml version="1.0" encoding="UTF-8"?>
<!-- Tiny ISO Schematron mirroring the kind of project rules Bilderfassung.sch enforces.
     XSLT1 query binding so lxml.isoschematron (XSLT1) can run it without Java/Saxon. -->
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xslt1">
  <ns prefix="tei" uri="http://www.tei-c.org/ns/1.0"/>

  <pattern id="word-ids">
    <rule context="tei:w">
      <assert test="@xml:id">Every word (w) must carry an xml:id so StandOff entries can target it.</assert>
    </rule>
  </pattern>

  <pattern id="standoff-targets">
    <rule context="tei:standOff/tei:note[@target]">
      <let name="t" value="substring-after(@target, '#')"/>
      <assert test="//*[@xml:id = $t]">standOff note/@target must reference an existing xml:id (got: <value-of select="@target"/>).</assert>
    </rule>
  </pattern>

  <pattern id="pb-facs">
    <rule context="tei:pb[@facs]">
      <let name="s" value="substring-after(@facs, '#')"/>
      <assert test="//tei:surface[@xml:id = $s]">pb/@facs must reference an existing surface (got: <value-of select="@facs"/>).</assert>
    </rule>
  </pattern>
</schema>
