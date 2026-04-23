package sy.gov.sla.organization.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.organization.api.BranchDto;
import sy.gov.sla.organization.api.CourtDto;
import sy.gov.sla.organization.api.DepartmentDto;
import sy.gov.sla.organization.domain.Branch;
import sy.gov.sla.organization.domain.Court;
import sy.gov.sla.organization.domain.Department;
import sy.gov.sla.organization.domain.DepartmentType;
import sy.gov.sla.organization.infrastructure.BranchRepository;
import sy.gov.sla.organization.infrastructure.CourtRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrganizationService {

    private final BranchRepository branchRepository;
    private final DepartmentRepository departmentRepository;
    private final CourtRepository courtRepository;

    public List<BranchDto> listBranches() {
        return branchRepository.findAll().stream()
                .sorted(Comparator.comparing(Branch::getId))
                .map(this::toDto)
                .toList();
    }

    public List<DepartmentDto> listDepartments(Long branchId) {
        if (!branchRepository.existsById(branchId)) {
            throw new NotFoundException("Branch not found: " + branchId);
        }
        return departmentRepository.findByBranchId(branchId).stream()
                .sorted(Comparator.comparing(Department::getType))
                .map(this::toDto)
                .toList();
    }

    public List<CourtDto> listCourts(Long branchId, DepartmentType departmentType) {
        List<Court> courts;
        if (branchId != null && departmentType != null) {
            courts = courtRepository.findByBranchIdAndDepartmentType(branchId, departmentType);
        } else if (branchId != null) {
            courts = courtRepository.findByBranchId(branchId);
        } else if (departmentType != null) {
            courts = courtRepository.findByDepartmentType(departmentType);
        } else {
            courts = courtRepository.findAll();
        }
        return courts.stream()
                .sorted(Comparator.comparing(Court::getId))
                .map(this::toDto)
                .toList();
    }

    public boolean courtExists(Long courtId) {
        return courtRepository.existsById(courtId);
    }

    public boolean departmentBelongsToBranch(Long departmentId, Long branchId) {
        return departmentRepository.existsByIdAndBranchId(departmentId, branchId);
    }

    /**
     * Lookup department by (branch, type). تُستخدم خارج وحدة organization عبر هذا الـ Service
     * بدلًا من حقن DepartmentRepository مباشرة (D-023).
     */
    public java.util.Optional<DepartmentDto> findDepartment(Long branchId, DepartmentType type) {
        return departmentRepository.findByBranchIdAndType(branchId, type).map(this::toDto);
    }

    /** يتحقق من التكامل: المحكمة تنتمي للفرع، والقسم يطابق نوع المحكمة، والقسم تحت الفرع. */
    public void validateConsistency(Long branchId, Long departmentId, Long courtId) {
        Department dept = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new NotFoundException("Department not found: " + departmentId));
        if (!dept.getBranchId().equals(branchId)) {
            throw new sy.gov.sla.common.exception.BadRequestException(
                    "INCONSISTENT_SCOPE", "Department does not belong to branch");
        }
        Court court = courtRepository.findById(courtId)
                .orElseThrow(() -> new NotFoundException("Court not found: " + courtId));
        if (!court.getBranchId().equals(branchId)) {
            throw new sy.gov.sla.common.exception.BadRequestException(
                    "INCONSISTENT_SCOPE", "Court does not belong to branch");
        }
        if (court.getDepartmentType() != dept.getType()) {
            throw new sy.gov.sla.common.exception.BadRequestException(
                    "INCONSISTENT_SCOPE", "Court department type does not match department");
        }
    }

    private BranchDto toDto(Branch b) {
        return new BranchDto(b.getId(), b.getCode(), b.getNameAr(), b.getProvinceName(), b.isActive());
    }

    private DepartmentDto toDto(Department d) {
        return new DepartmentDto(d.getId(), d.getBranchId(), d.getType(), d.getNameAr(), d.isActive());
    }

    private CourtDto toDto(Court c) {
        return new CourtDto(c.getId(), c.getBranchId(), c.getDepartmentType(), c.getNameAr(),
                c.isChamberSupport(), c.isActive());
    }
}

