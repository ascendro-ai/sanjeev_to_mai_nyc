/*
 * Modal Component Tests
 * Uncomment when tests are enabled
 */

// import { describe, it, expect, vi } from 'vitest'
// import { render, screen, fireEvent, waitFor } from '@testing-library/react'
// import userEvent from '@testing-library/user-event'
// import { Modal } from '../Modal'

// describe('Modal', () => {
//   it('should not render when isOpen=false', () => {
//     render(
//       <Modal isOpen={false} onClose={vi.fn()}>
//         <div>Modal Content</div>
//       </Modal>
//     )
//     expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
//   })

//   it('should render content when isOpen=true', () => {
//     render(
//       <Modal isOpen={true} onClose={vi.fn()}>
//         <div>Modal Content</div>
//       </Modal>
//     )
//     expect(screen.getByText('Modal Content')).toBeInTheDocument()
//   })

//   describe('closing behavior', () => {
//     it('should call onClose when clicking overlay', async () => {
//       const handleClose = vi.fn()
//       render(
//         <Modal isOpen={true} onClose={handleClose}>
//           <div>Content</div>
//         </Modal>
//       )
//       fireEvent.click(screen.getByTestId('modal-overlay'))
//       expect(handleClose).toHaveBeenCalledTimes(1)
//     })

//     it('should call onClose when pressing Escape', async () => {
//       const handleClose = vi.fn()
//       render(
//         <Modal isOpen={true} onClose={handleClose}>
//           <div>Content</div>
//         </Modal>
//       )
//       fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
//       expect(handleClose).toHaveBeenCalledTimes(1)
//     })

//     it('should not close when clicking modal content', async () => {
//       const handleClose = vi.fn()
//       render(
//         <Modal isOpen={true} onClose={handleClose}>
//           <div data-testid="modal-content">Content</div>
//         </Modal>
//       )
//       fireEvent.click(screen.getByTestId('modal-content'))
//       expect(handleClose).not.toHaveBeenCalled()
//     })

//     it('should not close on overlay click when closeOnOverlayClick=false', async () => {
//       const handleClose = vi.fn()
//       render(
//         <Modal isOpen={true} onClose={handleClose} closeOnOverlayClick={false}>
//           <div>Content</div>
//         </Modal>
//       )
//       fireEvent.click(screen.getByTestId('modal-overlay'))
//       expect(handleClose).not.toHaveBeenCalled()
//     })

//     it('should not close on Escape when closeOnEscape=false', async () => {
//       const handleClose = vi.fn()
//       render(
//         <Modal isOpen={true} onClose={handleClose} closeOnEscape={false}>
//           <div>Content</div>
//         </Modal>
//       )
//       fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
//       expect(handleClose).not.toHaveBeenCalled()
//     })
//   })

//   describe('size classes', () => {
//     it('should apply sm size classes', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()} size="sm">
//           <div>Content</div>
//         </Modal>
//       )
//       const modal = screen.getByRole('dialog')
//       expect(modal).toHaveClass('max-w-sm')
//     })

//     it('should apply md size classes (default)', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()} size="md">
//           <div>Content</div>
//         </Modal>
//       )
//       const modal = screen.getByRole('dialog')
//       expect(modal).toHaveClass('max-w-md')
//     })

//     it('should apply lg size classes', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()} size="lg">
//           <div>Content</div>
//         </Modal>
//       )
//       const modal = screen.getByRole('dialog')
//       expect(modal).toHaveClass('max-w-lg')
//     })

//     it('should apply xl size classes', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()} size="xl">
//           <div>Content</div>
//         </Modal>
//       )
//       const modal = screen.getByRole('dialog')
//       expect(modal).toHaveClass('max-w-xl')
//     })

//     it('should apply full size classes', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()} size="full">
//           <div>Content</div>
//         </Modal>
//       )
//       const modal = screen.getByRole('dialog')
//       expect(modal).toHaveClass('max-w-full')
//     })
//   })

//   describe('focus trap', () => {
//     it('should trap focus within modal', async () => {
//       const user = userEvent.setup()
//       render(
//         <Modal isOpen={true} onClose={vi.fn()}>
//           <button>First</button>
//           <button>Second</button>
//           <button>Third</button>
//         </Modal>
//       )

//       const buttons = screen.getAllByRole('button')
//       buttons[0].focus()
//       expect(document.activeElement).toBe(buttons[0])

//       await user.tab()
//       expect(document.activeElement).toBe(buttons[1])

//       await user.tab()
//       expect(document.activeElement).toBe(buttons[2])

//       // Should cycle back to first focusable element
//       await user.tab()
//       expect(document.activeElement).toBe(buttons[0])
//     })

//     it('should focus first focusable element on open', async () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()}>
//           <button>Focusable</button>
//         </Modal>
//       )

//       await waitFor(() => {
//         expect(document.activeElement).toBe(screen.getByRole('button'))
//       })
//     })
//   })

//   describe('title', () => {
//     it('should render title correctly', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()} title="Modal Title">
//           <div>Content</div>
//         </Modal>
//       )
//       expect(screen.getByText('Modal Title')).toBeInTheDocument()
//     })

//     it('should set aria-labelledby when title is provided', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()} title="Modal Title">
//           <div>Content</div>
//         </Modal>
//       )
//       const modal = screen.getByRole('dialog')
//       expect(modal).toHaveAttribute('aria-labelledby')
//     })

//     it('should render without title', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()}>
//           <div>Content only</div>
//         </Modal>
//       )
//       expect(screen.getByText('Content only')).toBeInTheDocument()
//     })
//   })

//   describe('accessibility', () => {
//     it('should have role="dialog"', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()}>
//           <div>Content</div>
//         </Modal>
//       )
//       expect(screen.getByRole('dialog')).toBeInTheDocument()
//     })

//     it('should have aria-modal="true"', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()}>
//           <div>Content</div>
//         </Modal>
//       )
//       expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
//     })
//   })

//   describe('body scroll lock', () => {
//     it('should prevent body scroll when open', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()}>
//           <div>Content</div>
//         </Modal>
//       )
//       expect(document.body.style.overflow).toBe('hidden')
//     })

//     it('should restore body scroll when closed', () => {
//       const { rerender } = render(
//         <Modal isOpen={true} onClose={vi.fn()}>
//           <div>Content</div>
//         </Modal>
//       )
//       rerender(
//         <Modal isOpen={false} onClose={vi.fn()}>
//           <div>Content</div>
//         </Modal>
//       )
//       expect(document.body.style.overflow).toBe('')
//     })
//   })

//   describe('close button', () => {
//     it('should render close button when showCloseButton=true', () => {
//       render(
//         <Modal isOpen={true} onClose={vi.fn()} showCloseButton>
//           <div>Content</div>
//         </Modal>
//       )
//       expect(screen.getByLabelText('Close')).toBeInTheDocument()
//     })

//     it('should call onClose when close button clicked', () => {
//       const handleClose = vi.fn()
//       render(
//         <Modal isOpen={true} onClose={handleClose} showCloseButton>
//           <div>Content</div>
//         </Modal>
//       )
//       fireEvent.click(screen.getByLabelText('Close'))
//       expect(handleClose).toHaveBeenCalledTimes(1)
//     })
//   })
// })

export {}
