import { Component } from "react";
export default class MapBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="error-banner">
        The map could not load. You can still use the shop list or enter
        coordinates. Save your receipt before reopening the app.
        <button
          type="button"
          className="secondary"
          onClick={() => this.setState({ failed: false })}
        >
          Retry map
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
