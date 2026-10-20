  globalThis.siteParams = {
    ...{{ site.Params | jsonify | safeJS }},
    tag_id_map: {{ (index site.Data "tag-id-map") | default dict | jsonify | safeJS }},
  };
