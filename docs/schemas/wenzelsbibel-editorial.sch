<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xslt1" defaultPhase="editing">
  <title>Wenzelsbibel image annotations: teiCrafter editorial profile</title>
  <ns prefix="tei" uri="http://www.tei-c.org/ns/1.0"/>
  <p>This teiCrafter-authored profile defines the image-annotation fields supported by the editor. The original Bilderfassung.sch was unavailable when this profile was defined. The default editing phase permits unfinished records so that intermediate XML remains saveable alongside TEI All validation. The review phase checks editorial completeness. Cross-document targets require the associated codex in the editor.</p>
  <phase id="editing">
    <active pattern="editing-structure"/>
  </phase>
  <phase id="review">
    <active pattern="editing-structure"/>
    <active pattern="image-records"/>
    <active pattern="artist-references"/>
    <active pattern="iconclass-labels"/>
    <active pattern="text-ranges"/>
  </phase>
  <pattern id="editing-structure">
    <rule context="/">
      <assert test="tei:TEI">The Wenzelsbibel workspace requires a TEI document root in the TEI namespace.</assert>
    </rule>
  </pattern>
  <pattern id="image-records">
    <rule context="tei:list[@type='image-annotations']/tei:item">
      <assert test="tei:title[normalize-space(.) != '']">An image annotation needs a nonempty title.</assert>
      <assert test="tei:note[@type='description'][@subtype='short'][normalize-space(.) != '']">An image annotation needs a nonempty short description.</assert>
      <assert test="tei:note[@type='description'][not(@subtype)][normalize-space(.) != '']">An image annotation needs a nonempty full description.</assert>
      <assert test="tei:ref[@type='folio'][normalize-space(@target) != '']">An image annotation needs a folio target.</assert>
      <assert test="tei:dimensions/tei:height[number(.) &gt; 0]">An image annotation needs a positive height.</assert>
      <assert test="tei:listPerson[@type='artists']/tei:person[normalize-space(@corresp) != '']">An image annotation needs an artist attribution.</assert>
    </rule>
  </pattern>
  <pattern id="artist-references">
    <rule context="tei:list[@type='image-annotations']/tei:item/tei:listPerson[@type='artists']/tei:person">
      <let name="refs" value="normalize-space(@corresp)"/>
      <let name="tokens" value="1 + string-length($refs) - string-length(translate($refs, ' ', ''))"/>
      <assert test="$refs != '' and count(/tei:TEI/tei:teiHeader//tei:respStmt/tei:persName[@xml:id][contains(concat(' ', $refs, ' '), concat(' #', @xml:id, ' '))]) = $tokens">Every artist pointer must resolve to a distinct persName identifier in a header respStmt.</assert>
    </rule>
  </pattern>
  <pattern id="iconclass-labels">
    <rule context="tei:list[@type='image-annotations']/tei:item//tei:ref[@type='iconclass-label']">
      <assert test="normalize-space(@corresp) != ''">An Iconclass entry needs a target.</assert>
      <assert test="tei:desc[@xml:lang='de'][normalize-space(.) != '']">Each Iconclass entry needs a nonempty German label.</assert>
      <assert test="tei:desc[@xml:lang='en'][normalize-space(.) != '']">Each Iconclass entry needs a nonempty English label.</assert>
    </rule>
  </pattern>
  <pattern id="text-ranges">
    <rule context="tei:list[@type='image-annotations']/tei:item/tei:note[@type='text-relation'][@subtype='statistic']">
      <let name="range" value="normalize-space(@corresp)"/>
      <let name="body" value="substring-before(substring-after($range, '#range('), ')')"/>
      <let name="start" value="normalize-space(substring-before($body, ','))"/>
      <let name="end" value="normalize-space(substring-after($body, ','))"/>
      <assert test="starts-with($range, '#range(') and substring($range, string-length($range), 1) = ')' and string-length($range) - string-length(translate($range, '(', '')) = 1 and string-length($range) - string-length(translate($range, ')', '')) = 1 and string-length($body) - string-length(translate($body, ',', '')) = 1 and $start != '' and $end != '' and not(contains($start, ' ')) and not(contains($end, ' '))">A statistical text relation needs #range(start,end) with two nonempty identifiers.</assert>
    </rule>
  </pattern>
</schema>
