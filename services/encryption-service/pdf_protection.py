"""
CipherVault — PDF Protection
Applies additional security restrictions to PDF files using pikepdf.
"""
import io
import os
import secrets
import pikepdf


def protect_pdf(
    pdf_data: bytes,
    user_password: str,
    owner_password: str = None,
) -> bytes:
    """
    Apply PDF-level protection using pikepdf.
    
    Restrictions applied:
      - No printing
      - No copying
      - No editing
      - No annotations
    
    Args:
        pdf_data: Raw PDF file bytes
        user_password: Password required to open the document
        owner_password: Password for owner permissions (auto-generated if None)
    
    Returns:
        Protected PDF bytes
    """
    if owner_password is None:
        owner_password = secrets.token_hex(32)

    input_pdf = io.BytesIO(pdf_data)
    output_pdf = io.BytesIO()

    with pikepdf.open(input_pdf) as pdf:
        permissions = pikepdf.Permissions(
            print_lowres=False,
            print_highres=False,
            extract=False,
            modify_annotation=False,
            modify_assembly=False,
            modify_form=False,
            modify_other=False,
            accessibility=True,  # Keep accessibility
        )

        pdf.save(
            output_pdf,
            encryption=pikepdf.Encryption(
                user=user_password,
                owner=owner_password,
                R=6,  # AES-256 encryption (PDF 2.0)
                allow=permissions,
            ),
        )

    return output_pdf.getvalue()


def remove_pdf_protection(pdf_data: bytes, password: str) -> bytes:
    """
    Remove PDF protection using the user password.
    
    Args:
        pdf_data: Protected PDF bytes
        password: User password
    
    Returns:
        Unprotected PDF bytes
    """
    input_pdf = io.BytesIO(pdf_data)
    output_pdf = io.BytesIO()

    with pikepdf.open(input_pdf, password=password) as pdf:
        pdf.save(output_pdf)

    return output_pdf.getvalue()
