import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            maxWidth: 560,
            margin: '48px auto',
            padding: 28,
            borderRadius: 16,
            background: '#fff',
            boxShadow: '0 10px 30px rgba(0,26,84,.12)',
            fontFamily: 'Segoe UI, system-ui, sans-serif',
            color: '#16213a',
            textAlign: 'center'
          }}
        >
          <h2 style={{ color: '#001a54', marginBottom: 10 }}>Algo salió mal</h2>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#fde3e7',
              color: '#d00c27',
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
              textAlign: 'left'
            }}
          >
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#d00c27',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: 12
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}