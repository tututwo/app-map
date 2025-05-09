import { CompositeLayer } from "@deck.gl/core";
import type { UpdateParameters } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import { feature as topojsonFeature } from "topojson-client";
import type { LayerProps } from "@deck.gl/core";
import type { GeoJsonLayerProps } from "@deck.gl/layers";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from "geojson";

// Import all GeoJsonLayer default props
const defaultProps = {
  ...GeoJsonLayer.defaultProps,
  data: { type: "object", value: null, async: false },
};

interface TopoJSONLayerProps extends LayerProps {
  data: any; // TopoJSON data
  getFillColor?: (d: any) => number[];
  getLineColor?: (d: any) => number[];
  getPointRadius?: (d: any) => number;
  getLineWidth?: (d: any) => number;
  getElevation?: (d: any) => number;
  getIcon?: (d: any) => string;
  getText?: (d: any) => string;
}

export default class TopoJSONLayer extends CompositeLayer<TopoJSONLayerProps> {
  static layerName = "TopoJSONLayer";
  static defaultProps = defaultProps;

  initializeState() {
    this.state = {
      geojsonData: null,
    };
  }

  updateState(params: UpdateParameters<this>) {
    const { props, oldProps, changeFlags } = params;
    if (changeFlags.dataChanged) {
      this._processData(props.data);
    }
  }

  _processData(data: any) {
    let topojsonData;

    if (typeof data === "string") {
      // Data is a URL (synchronous data not supported in this case)
      throw new Error("String URLs are not supported for data prop in TopoJSONLayer.");
    } else {
      // Data is an object (TopoJSON)
      topojsonData = data;
    }

    // Convert TopoJSON to GeoJSON synchronously
    const geojsonFeatures = [];
    for (const key in topojsonData.objects) {
      const geojsonObject = topojsonFeature(topojsonData, topojsonData.objects[key]);

      if (this.isFeatureCollection(geojsonObject)) {
        for (let i = 0; i < geojsonObject.features.length; i++) {
          const feature = geojsonObject.features[i];
          geojsonFeatures.push(this.getSubLayerRow(feature, feature, i));
        }
      } else if (this.isFeature(geojsonObject)) {
        const feature = geojsonObject;
        geojsonFeatures.push(this.getSubLayerRow(feature, feature, 0));
      }
    }

    // Combine features into a single FeatureCollection
    const geojsonData: FeatureCollection = {
      type: "FeatureCollection",
      features: geojsonFeatures,
    };

    // Store the converted data in state
    this.setState({ geojsonData });
  }

  private isFeatureCollection(obj: any): obj is FeatureCollection<Geometry, GeoJsonProperties> {
    return obj.type === "FeatureCollection" && Array.isArray(obj.features);
  }

  private isFeature(obj: any): obj is Feature<Geometry, GeoJsonProperties> {
    return obj.type === "Feature" && obj.geometry !== undefined;
  }

  renderLayers() {
    const { geojsonData } = this.state;

    if (!geojsonData) {
      return null;
    }

    // Forward all props to GeoJsonLayer, wrapping accessors
    return new GeoJsonLayer(
      this.getSubLayerProps({
        ...this.props,
        id: "geojson-layer",
        data: geojsonData,
        getFillColor: this.getSubLayerAccessor(this.props.getFillColor),
        getLineColor: this.getSubLayerAccessor(this.props.getLineColor),
        getPointRadius: this.getSubLayerAccessor(this.props.getPointRadius),
        getLineWidth: this.getSubLayerAccessor(this.props.getLineWidth),
        getElevation: this.getSubLayerAccessor(this.props.getElevation),
        getIcon: this.getSubLayerAccessor(this.props.getIcon),
        getText: this.getSubLayerAccessor(this.props.getText),
      })
    );
  }

  getPickingInfo({ info, sourceLayer }: { info: any; sourceLayer: any }) {
    // Map the picked object back to the original data
    if (info.object && info.object.__source) {
      info.object = info.object.__source.object;
      info.index = info.object.__source.index;
    }
    return info;
  }
}
